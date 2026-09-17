// The process layer: one app is one script of one project, running in its own pseudo terminal.
// No Electron here, so the tests run in plain Node against real processes.
import { execFileSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import * as pty from 'node-pty'
import type { AppState, RunningApp, StartApp } from '../shared/ipc.ts'

/** What a terminal panel can show without holding a whole run in memory. */
const BUFFER_LIMIT = 200_000
const SIGKILL_AFTER_MS = 5_000

type Entry = {
  app: RunningApp
  terminal: pty.IPty
  buffer: string
}

type Events = {
  output: [string, string]
  state: [RunningApp]
}

export function appId(project: string, script: string): string {
  return `${project}#${script}`
}

/** Every process alive right now, as `ps` sees it. */
function processes(): { pid: number; ppid: number; pgid: number; command: string }[] {
  return execFileSync('ps', ['-A', '-o', 'pid=,ppid=,pgid=,command='], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/))
    .filter((match) => match !== null)
    .map((match) => ({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
      command: match[4] ?? '',
    }))
}

/** A process and everything it started, however deep: `pnpm` is never the only one holding a port. */
export function processTree(root: number): number[] {
  const all = processes()
  const found = all.filter((proc) => proc.pid === root).map((proc) => proc.pid)

  for (let index = 0; index < found.length; index++) {
    for (const proc of all) {
      if (proc.ppid === found[index] && !found.includes(proc.pid)) found.push(proc.pid)
    }
  }

  return found
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class Apps extends EventEmitter<Events> {
  private readonly entries = new Map<string, Entry>()

  list(): RunningApp[] {
    return [...this.entries.values()].map((entry) => ({ ...entry.app }))
  }

  get(id: string): RunningApp | undefined {
    const entry = this.entries.get(id)
    return entry === undefined ? undefined : { ...entry.app }
  }

  buffer(id: string): string {
    return this.entries.get(id)?.buffer ?? ''
  }

  /**
   * Starts `pnpm <script>` in the project, inside a pseudo terminal. The terminal is what makes Expo print its
   * QR code and its shortcuts, keeps colours, and lets the user answer a question the app asks.
   * node-pty makes the child a session leader, so its whole tree shares one process group.
   */
  start({ project, script, cols = 110, rows = 30 }: StartApp): RunningApp {
    const id = appId(project, script)
    const current = this.entries.get(id)

    if (
      current !== undefined &&
      (current.app.state === 'running' || current.app.state === 'starting')
    ) {
      return { ...current.app }
    }

    const terminal = pty.spawn('pnpm', [script], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: project,
      env: process.env as Record<string, string>,
    })

    const entry: Entry = {
      app: { id, project, script, state: 'starting' },
      terminal,
      buffer: '',
    }
    this.entries.set(id, entry)

    terminal.onData((data) => {
      entry.buffer = (entry.buffer + data).slice(-BUFFER_LIMIT)
      // The first output means the command is alive; whether it is serving anything is not ours to judge.
      if (entry.app.state === 'starting') this.change(entry, 'running')
      this.emit('output', id, data)
    })

    terminal.onExit(({ exitCode }) => {
      entry.app.exitCode = exitCode
      // Only an exit the Desktop did not ask for is a failure; `stop` marks the app stopped itself.
      if (entry.app.state !== 'stopped') this.change(entry, exitCode === 0 ? 'stopped' : 'failed')
    })

    this.emit('state', { ...entry.app })

    return { ...entry.app }
  }

  write(id: string, data: string): void {
    this.entries.get(id)?.terminal.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.entries.get(id)?.terminal.resize(cols, rows)
  }

  /**
   * Stops an app by signalling its **whole process group**, not only `pnpm`: killing the parent alone leaves
   * Vite, Nest or Metro holding their ports. SIGTERM first, SIGKILL for whatever is still there.
   */
  async stop(id: string): Promise<RunningApp | undefined> {
    const entry = this.entries.get(id)

    if (entry === undefined) return undefined
    if (entry.app.state === 'stopped' || entry.app.state === 'failed') return { ...entry.app }

    const members = processTree(entry.terminal.pid)
    this.change(entry, 'stopped')
    this.signal(entry.terminal.pid, 'SIGTERM')

    for (let waited = 0; waited < SIGKILL_AFTER_MS; waited += 200) {
      await sleep(200)
      if (!this.anyAlive(members)) return { ...entry.app }
    }

    this.signal(entry.terminal.pid, 'SIGKILL')
    await sleep(500)

    return { ...entry.app }
  }

  /** Used when the Desktop quits: nothing it started may outlive it. */
  async stopAll(): Promise<void> {
    await Promise.all(this.list().map((app) => this.stop(app.id)))
  }

  /** The same, without waiting: `before-quit` has no time to await anything. */
  stopAllNow(): void {
    for (const entry of this.entries.values()) {
      if (entry.app.state === 'running' || entry.app.state === 'starting') {
        this.change(entry, 'stopped')
        this.signal(entry.terminal.pid, 'SIGTERM')
      }
    }
  }

  private anyAlive(pids: number[]): boolean {
    const alive = new Set(processes().map((proc) => proc.pid))
    return pids.some((pid) => alive.has(pid))
  }

  private signal(pid: number, signal: 'SIGTERM' | 'SIGKILL'): void {
    try {
      // A negative pid is the process group: on macOS and Linux the pseudo terminal's child leads its own.
      process.kill(-pid, signal)
    } catch {
      // Already gone, which is the outcome we wanted anyway.
    }
  }

  private change(entry: Entry, state: AppState): void {
    entry.app.state = state
    this.emit('state', { ...entry.app })
  }
}
