// Spike: proves the risky parts of Prumo Desktop, writes a JSON report, and quits.
// Throwaway code: it answers questions, it is not the foundation.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import fixPath from 'fix-path'
import * as pty from 'node-pty'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

const out = join(app.getPath('userData'), 'spike')
const reportPath = join(out, 'report.json')
const report: Record<string, unknown> = { startedAt: new Date().toISOString(), packaged: app.isPackaged }
const running = new Map<string, pty.IPty>()
let window: BrowserWindow | undefined
let rendererReady = false
const buffers = new Map<string, string>()

mkdirSync(out, { recursive: true })

function save(key: string, value: unknown) {
  report[key] = value
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
}

function findOnPath(command: string): string | undefined {
  return (process.env.PATH ?? '')
    .split(delimiter)
    .map((directory) => join(directory, command))
    .find((candidate) => existsSync(candidate))
}

// Runs a CLI command the way the Desktop will: a plain child process, never a pseudo terminal.
function runCli(node: string, cli: string, args: string[], cwd: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; document?: unknown }>((done) => {
    const child = spawn(node, [cli, ...args], { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('close', (code) => {
      let document: unknown
      try {
        document = JSON.parse(stdout)
      } catch {
        document = undefined
      }
      done({ code, stdout, stderr: stderr.slice(-2000), document })
    })
  })
}

type Proc = { pid: number; ppid: number; pgid: number; command: string }

function processes(): Proc[] {
  return execFileSync('ps', ['-A', '-o', 'pid=,ppid=,pgid=,command='], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/))
    .filter((match) => match !== null)
    .map((match) => ({ pid: Number(match[1]), ppid: Number(match[2]), pgid: Number(match[3]), command: match[4] }))
}

function tree(root: number): Proc[] {
  const all = processes()
  const found = all.filter((proc) => proc.pid === root)
  for (let index = 0; index < found.length; index++) {
    found.push(...all.filter((proc) => proc.ppid === found[index].pid))
  }
  return found
}

function listeningPorts(pids: number[]): number[] {
  if (pids.length === 0) return []
  try {
    const text = execFileSync('lsof', ['-nP', '-a', '-p', pids.join(','), '-iTCP', '-sTCP:LISTEN'], {
      encoding: 'utf8',
    })
    return [...new Set([...text.matchAll(/:(\d+) \(LISTEN\)/g)].map((match) => Number(match[1])))]
  } catch {
    return []
  }
}

function portListening(port: number): boolean {
  try {
    execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
    return true
  } catch {
    return false
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function startApp(name: string, cwd: string, ready: RegExp, timeoutMs: number) {
  return new Promise<{ ready: boolean; match?: string; output: string; ms: number }>((done) => {
    const started = Date.now()
    const term = pty.spawn('pnpm', [name], {
      name: 'xterm-256color',
      cols: 110,
      rows: 45,
      cwd,
      env: { ...process.env, FORCE_COLOR: '1' } as Record<string, string>,
    })
    running.set(name, term)
    buffers.set(name, '')
    let finished = false
    let answered = false
    const finish = (value: { ready: boolean; match?: string }) => {
      if (finished) return
      finished = true
      done({ ...value, output: buffers.get(name) ?? '', ms: Date.now() - started })
    }
    term.onData((data) => {
      buffers.set(name, (buffers.get(name) ?? '') + data)
      if (rendererReady) window?.webContents.send('spike:pty', name, data)
      // biome-ignore lint: strip ANSI escapes before matching
      const plain = (buffers.get(name) ?? '').replace(/\[[0-9;?]*[a-zA-Z]/g, '')
      // Expo asks before taking another port; answering proves input reaches the process through the terminal.
      if (!answered && /Use port \d+ instead\?/.test(plain)) {
        answered = true
        term.write('\r')
      }
      const match = plain.match(ready)
      if (match) finish({ ready: true, match: match[0] })
    })
    term.onExit(({ exitCode }) => {
      running.delete(name)
      finish({ ready: false, match: `exited ${exitCode}` })
    })
    setTimeout(() => finish({ ready: false }), timeoutMs)
  })
}

// Stops a pseudo terminal's whole process group: node-pty makes the child a session leader.
async function stopApp(name: string) {
  const term = running.get(name)
  if (term === undefined) return { stopped: false, reason: 'not running' }
  const members = tree(term.pid)
  const ports = listeningPorts(members.map((proc) => proc.pid))
  const groups = [...new Set(members.map((proc) => proc.pgid))]
  process.kill(-term.pid, 'SIGTERM')
  let alive: Proc[] = []
  for (let waited = 0; waited < 10_000; waited += 250) {
    await sleep(250)
    const pids = new Set(processes().map((proc) => proc.pid))
    alive = members.filter((proc) => pids.has(proc.pid))
    if (alive.length === 0) break
  }
  const usedSigkill = alive.length > 0
  if (usedSigkill) {
    for (const group of groups) {
      try {
        process.kill(-group, 'SIGKILL')
      } catch {}
    }
    await sleep(1000)
  }
  const pidsAfter = new Set(processes().map((proc) => proc.pid))
  running.delete(name)
  return {
    rootPid: term.pid,
    processGroups: groups,
    processesBefore: members.length,
    commands: members.map((proc) => `${proc.pid}/${proc.pgid} ${proc.command.slice(0, 90)}`),
    portsBefore: ports,
    usedSigkill,
    aliveAfterSigterm: alive.map((proc) => proc.command.slice(0, 90)),
    survivors: members.filter((proc) => pidsAfter.has(proc.pid)).map((proc) => proc.command.slice(0, 90)),
    portsStillListening: ports.filter(portListening),
  }
}

async function runProofs() {
  // 1. PATH from an app opened in Finder.
  const before = { PATH: process.env.PATH, node: findOnPath('node'), pnpm: findOnPath('pnpm') }
  fixPath()
  const node = findOnPath('node')
  save('1-path', {
    before,
    after: { PATH: process.env.PATH, node, pnpm: findOnPath('pnpm') },
    nodeVersion: node ? execFileSync(node, ['--version'], { encoding: 'utf8' }).trim() : undefined,
  })
  if (node === undefined) return

  // 2. The embedded CLI, run with the system's Node from outside app.asar.
  const cli = app.isPackaged
    ? join(process.resourcesPath, 'prumo', 'dist', 'cli.js')
    : join(__dirname, '..', '..', 'resources', 'prumo', 'dist', 'cli.js')
  const workDir = join(out, 'projects')
  mkdirSync(workDir, { recursive: true })
  const stamp = Date.now().toString(36)
  const name = `spike-${stamp}`
  const project = join(workDir, name)
  const proof2: Record<string, unknown> = { cli, cliExists: existsSync(cli), asarPath: app.getAppPath() }
  proof2.version = await runCli(node, cli, ['version', '--json'], workDir)
  proof2.doctor = await runCli(node, cli, ['doctor', '--json'], workDir)
  proof2.invalidName = await runCli(
    node,
    cli,
    ['new', 'Bad Name', '--types', 'web', '--alone', '--single-tenant', '--json'],
    workDir,
  )
  save('2-cli', proof2)
  const created = Date.now()
  proof2.new = await runCli(
    node,
    cli,
    ['new', name, '--types', 'api,web,mobile', '--monorepo', '--single-tenant', '--json'],
    workDir,
  )
  proof2.newMs = Date.now() - created
  proof2.dbCheckBefore = await runCli(node, cli, ['db', '--check', '--json'], project)
  proof2.dbCreate = await runCli(node, cli, ['db', '--name', `spike_${stamp}`, '--json'], project)
  proof2.dbCheckAfter = await runCli(node, cli, ['db', '--check', '--json'], project)
  save('2-cli', proof2)
  if ((proof2.new as { code: number | null }).code !== 0) return

  // This machine already runs another project's API on 3000; the spike's API moves out of its way.
  const apiEnv = join(project, 'apps', 'api', '.env')
  writeFileSync(apiEnv, readFileSync(apiEnv, 'utf8').replace(/^PORT=.*$/m, 'PORT=3100'))

  // 3 and 4. Each app in its own pseudo terminal, then its process group stopped.
  const apps: [string, RegExp, number][] = [
    ['web', /Local:\s+http:\/\/localhost:\d+/, 90_000],
    ['api', /Nest application successfully started|listening on|Application is running/i, 180_000],
    ['mobile', /exp:\/\/[^\s]+/, 240_000],
  ]
  const proof34: Record<string, unknown> = { project }
  for (const [appName, ready, timeout] of apps) {
    const result = await startApp(appName, project, ready, timeout)
    const term = running.get(appName)
    const members = term ? tree(term.pid) : []
    proof34[appName] = {
      ready: result.ready,
      match: result.match,
      ms: result.ms,
      ports: listeningPorts(members.map((proc) => proc.pid)),
      qrBlocks: (result.output.match(/[▀▄█]/g) ?? []).length,
      tail: result.output.replace(/\[[0-9;?]*[a-zA-Z]/g, '').slice(-1500),
    }
    save('3-4-apps', proof34)
  }
  await sleep(3000)
  if (window) {
    const image = await window.webContents.capturePage()
    writeFileSync(join(out, 'mobile-terminal.png'), image.toPNG())
  }
  for (const [appName] of apps) {
    ;(proof34[appName] as Record<string, unknown>).stop = await stopApp(appName)
    save('3-4-apps', proof34)
  }

  // Quitting with an app running: web is started again and left for before-quit to stop.
  const again = await startApp('web', project, /Local:\s+http:\/\/localhost:\d+/, 90_000)
  const webTerm = running.get('web')
  save('quit', {
    webReady: again.ready,
    webPorts: webTerm ? listeningPorts(tree(webTerm.pid).map((proc) => proc.pid)) : [],
    appPid: process.pid,
  })
}

app.on('before-quit', () => {
  for (const term of running.values()) {
    try {
      process.kill(-term.pid, 'SIGTERM')
    } catch {}
  }
  save('finishedAt', new Date().toISOString())
})

ipcMain.handle('spike:ready', () => {
  rendererReady = true
  return Object.fromEntries(buffers)
})

ipcMain.handle('spike:router', (_event, info) => {
  save('6-router', info)
})

app.whenReady().then(async () => {
  window = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: { preload: join(__dirname, 'preload.js') },
  })
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    await window.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }
  save('5-vite', { renderedFrom: window.webContents.getURL() })
  try {
    await runProofs()
  } catch (error) {
    save('error', String((error as Error).stack ?? error))
  }
  await sleep(2000)
  app.quit()
})
