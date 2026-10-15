// The process layer: one app is one script of one project, running in its own pseudo terminal.
// No Electron here, so the tests run in plain Node against real processes.
import { execFileSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import * as pty from 'node-pty'
import type { AppState, RunningApp, StartApp } from '../shared/ipc.ts'

/** What a terminal panel can show without holding a whole run in memory. */
const BUFFER_LIMIT = 200_000
const SIGKILL_AFTER_MS = 5_000

const windows = process.platform === 'win32'

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

/** A process as the system lists it. `started` is its creation time on Windows (a FILETIME), and 0 elsewhere. */
type Proc = { pid: number; ppid: number; started: number }

/** Every process alive right now: `ps` on macOS and Linux, Win32_Process on Windows. */
function processes(): Proc[] {
  if (windows) {
    // The creation time is what tells a real child from a process that reused its parent's number (below).
    const listed = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $(if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc() } else { 0 })" }',
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 60_000 },
    )

    return listed
      .split('\n')
      .map((line) => line.trim().split(/\s+/).map(Number))
      .filter(([pid, ppid]) => Number.isInteger(pid) && Number.isInteger(ppid))
      .map(([pid = 0, ppid = 0, started = 0]) => ({ pid, ppid, started }))
  }

  return execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)$/))
    .filter((match) => match !== null)
    .map((match) => ({ pid: Number(match[1]), ppid: Number(match[2]), started: 0 }))
}

/**
 * A process and everything it started, however deep, with when each started: `pnpm` is never the only one holding a
 * port.
 *
 * On Windows a process keeps its parent's id after the parent exits, and the id is then given to the next process
 * that starts, so a tree followed by ids alone can adopt a stranger, even a system process. A child is therefore
 * only taken as one when it started after its parent, as Prumo's own scripts/ports.mjs does since 0.5.0.
 */
function tree(root: number): Map<number, number> {
  const all = processes()
  const started = new Map(all.map((proc) => [proc.pid, proc.started]))
  const found = new Map<number, number>()

  if (!started.has(root)) return found
  found.set(root, started.get(root) ?? 0)

  for (const parent of found.keys()) {
    const parentStarted = found.get(parent) ?? 0
    for (const proc of all) {
      const honest = !windows || proc.started >= parentStarted
      if (proc.ppid === parent && proc.pid !== parent && honest && !found.has(proc.pid)) {
        found.set(proc.pid, proc.started)
      }
    }
  }

  return found
}

/** A process and everything it started, however deep: `pnpm` is never the only one holding a port. */
export function processTree(root: number): number[] {
  return [...tree(root).keys()]
}

/**
 * Ends a process and everything it started, at once and without asking: for a command that ran past its deadline.
 * The tree is read as above, so on Windows only true descendants are ended, each by its own id; never `taskkill /T`.
 */
export function endTree(root: number): void {
  const members = [...tree(root).keys()]

  if (members.length === 0) return

  if (windows) {
    try {
      execFileSync('taskkill', ['/F', ...members.flatMap((pid) => ['/PID', String(pid)])], {
        stdio: 'ignore',
        windowsHide: true,
        timeout: 60_000,
      })
    } catch {
      // Some had exited in between, which taskkill reports as a failure.
    }
    return
  }

  for (const pid of members.reverse()) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // Already gone.
    }
  }
}

/**
 * How `pnpm <script>` is started in the pseudo terminal. node-pty looks a command up on Windows without PATHEXT, so
 * `pnpm` alone, a `pnpm.cmd`, is not found, and a batch file is only run through cmd.exe anyway. `/d` skips cmd's
 * AutoRun commands, and `/s /c` runs the quoted command line as it is (cmd /?).
 */
function command(script: string): { file: string; args: string[] } {
  if (windows) {
    return {
      file: process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', `pnpm ${script}`],
    }
  }

  return { file: 'pnpm', args: [script] }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Whether a process is still there: signal 0 tests without sending anything (kill(2), and Node on Windows). */
function running(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

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
   * On macOS and Linux node-pty makes the child a session leader, so its whole tree shares one process group.
   */
  start({ project, script, cols = 110, rows = 30, port }: StartApp): RunningApp {
    const id = appId(project, script)
    const current = this.entries.get(id)

    if (
      current !== undefined &&
      (current.app.state === 'running' || current.app.state === 'starting')
    ) {
      return { ...current.app }
    }

    const { file, args } = command(script)
    const terminal = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: project,
      env: process.env as Record<string, string>,
    })

    const entry: Entry = {
      app: { id, project, script, state: 'starting', port },
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
   * Stops an app with its **whole process tree**, not only `pnpm`: killing the parent alone leaves Vite, Fastify or
   * Metro holding their ports.
   *
   * macOS and Linux: SIGTERM to the process group, SIGKILL for whatever is still there.
   * Windows has no process groups. Ctrl+C goes into the terminal first, as a person would type it, so a generated
   * project's scripts/ports.mjs stops what it started; then the pseudo console is closed, which ends every process
   * attached to it; then whatever is left of the tree read before the first step is ended by its own id, and only
   * when that id still belongs to the process that was read, by its creation time. `taskkill /T` is never used: it
   * follows parent ids, which Windows does not keep honest.
   */
  async stop(id: string): Promise<RunningApp | undefined> {
    const entry = this.entries.get(id)

    if (entry === undefined) return undefined
    if (entry.app.state === 'stopped' || entry.app.state === 'failed') return { ...entry.app }

    const members = tree(entry.terminal.pid)
    this.change(entry, 'stopped')

    if (windows) {
      await this.stopOnWindows(entry, members)
      return { ...entry.app }
    }

    this.signal(entry.terminal.pid, 'SIGTERM')

    for (let waited = 0; waited < SIGKILL_AFTER_MS; waited += 200) {
      await sleep(200)
      if (!this.anyAlive([...members.keys()])) return { ...entry.app }
    }

    this.signal(entry.terminal.pid, 'SIGKILL')
    await sleep(500)

    return { ...entry.app }
  }

  private async stopOnWindows(entry: Entry, members: Map<number, number>): Promise<void> {
    // cmd.exe itself waits on "Terminate batch job (Y/N)?" after a Ctrl+C, so only what it started is waited for.
    const started = [...members.keys()].filter((pid) => pid !== entry.terminal.pid)

    entry.terminal.write('\x03')
    for (let waited = 0; waited < SIGKILL_AFTER_MS; waited += 250) {
      await sleep(250)
      if (!started.some(running)) break
    }

    try {
      entry.terminal.kill()
    } catch {
      // The terminal had already closed.
    }
    await sleep(500)

    const now = new Map(processes().map((proc) => [proc.pid, proc.started]))
    const left = [...members].filter(([pid, at]) => now.get(pid) === at).map(([pid]) => pid)

    if (left.length > 0) {
      try {
        execFileSync('taskkill', ['/F', ...left.flatMap((pid) => ['/PID', String(pid)])], {
          stdio: 'ignore',
          windowsHide: true,
          timeout: 60_000,
        })
      } catch {
        // Some had exited in between, which taskkill reports as a failure.
      }
      await sleep(500)
    }
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
        if (windows) {
          // Closing the pseudo console ends every process attached to it.
          try {
            entry.terminal.kill()
          } catch {}
        } else {
          this.signal(entry.terminal.pid, 'SIGTERM')
        }
      }
    }
  }

  private anyAlive(pids: number[]): boolean {
    const alive = new Set(processes().map((proc) => proc.pid))
    return pids.some((pid) => alive.has(pid))
  }

  /** Signals a process group; macOS and Linux only. */
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
