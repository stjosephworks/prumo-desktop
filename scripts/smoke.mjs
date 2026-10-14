// Checks a packaged build the way a user gets it, without a human watching.
//
//   pnpm package && node scripts/smoke.mjs
//
// It starts the app with the environment an app opened from the desktop receives: on macOS launchd's PATH from
// Finder, on Linux the bare system PATH a desktop entry may start with, and nothing else. Then it asks the renderer
// itself what the bridge returned and what the window shows. The app is closed at the end.
// Anything that needs a native dialog, such as adding a folder, is not reachable from here on purpose.
// On Linux it needs a display: in CI it runs under xvfb-run, against the installed deb.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FINDER_PATH = '/usr/bin:/bin:/usr/sbin:/sbin'
const LINUX_PATH = '/usr/bin:/bin'
// Built from the character code: an escape written into a regular expression is a control character.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[a-zA-Z]`, 'g')
const PORT = 9333

/**
 * The binary to check: `SMOKE_BINARY` when set, such as an installed package's (`/usr/bin/prumo-desktop`), or else
 * where Packager puts it in out/: inside the bundle on macOS, named by executableName on Linux (forge.config.js).
 */
function packagedBinary() {
  const out = join(import.meta.dirname, '..', 'out')
  const bundle = readdirSync(out).find((entry) => entry.startsWith('Prumo Desktop-'))

  if (bundle === undefined) throw new Error('No packaged app in out/. Run `pnpm package` first.')

  return {
    darwin: join(out, bundle, 'Prumo Desktop.app', 'Contents', 'MacOS', 'Prumo Desktop'),
    linux: join(out, bundle, 'prumo-desktop'),
    win32: join(out, bundle, 'Prumo Desktop.exe'),
  }[process.platform]
}

const binary = process.env.SMOKE_BINARY || packagedBinary()

if (binary === undefined || !existsSync(binary)) throw new Error(`No binary at ${binary}`)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Whether a port answers on either loopback address, asked over TCP: the same on every system, no lsof. */
async function portHeld(port) {
  const answers = (host) =>
    new Promise((done) => {
      const socket = connect({ host, port })
      const finish = (open) => {
        socket.destroy()
        done(open)
      }
      socket.setTimeout(1_000, () => finish(false))
      socket.once('connect', () => finish(true))
      socket.once('error', () => finish(false))
    })

  return (await answers('127.0.0.1')) || (await answers('::1'))
}

/**
 * Nothing but what the desktop hands an app: inheriting this shell's PATH would hide exactly the bug fix-path
 * exists for. Linux also passes on the display, which the app cannot open a window without. Windows gets the
 * variables every session has and a PATH of System32 alone, so Node and pnpm must come from the registry or a usual
 * install folder (src/main/windows-path.ts).
 */
const environment = {
  darwin: { PATH: FINDER_PATH, HOME: process.env.HOME },
  linux: {
    PATH: LINUX_PATH,
    HOME: process.env.HOME,
    DISPLAY: process.env.DISPLAY,
    XAUTHORITY: process.env.XAUTHORITY,
  },
  win32: {
    ...Object.fromEntries(
      [
        'SystemRoot',
        'windir',
        'SystemDrive',
        'ComSpec',
        'PATHEXT',
        'USERPROFILE',
        'USERNAME',
        'HOMEDRIVE',
        'HOMEPATH',
        'APPDATA',
        'LOCALAPPDATA',
        'ProgramFiles',
        'ProgramFiles(x86)',
        'ProgramData',
        'TEMP',
        'TMP',
      ].map((name) => [name, process.env[name]]),
    ),
    PATH: join(process.env.SystemRoot ?? 'C:\\Windows', 'System32'),
  },
}[process.platform]

const child = spawn(binary, [`--remote-debugging-port=${PORT}`], {
  env: Object.fromEntries(
    Object.entries(environment ?? {}).filter(([, value]) => value !== undefined),
  ),
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
child.stdout.on('data', (chunk) => (log += chunk))
child.stderr.on('data', (chunk) => (log += chunk))

async function page() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const found = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl)
      if (found) return found
    } catch {
      // Not listening yet.
    }
    await sleep(500)
  }
  throw new Error(`The app never exposed a page. Its output:\n${log}`)
}

function evaluate(socket, expression, id, timeoutMs = 300_000) {
  return new Promise((done, fail) => {
    const timer = setTimeout(
      () => fail(new Error(`\`${expression.slice(0, 60)}\` never answered. App output:\n${log}`)),
      timeoutMs,
    )
    const settle = (finish) => (value) => {
      clearTimeout(timer)
      finish(value)
    }
    done = settle(done)
    fail = settle(fail)
    const onMessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.id !== id) return
      socket.removeEventListener('message', onMessage)
      const result = message.result?.result
      if (result?.subtype === 'error') return fail(new Error(result.description))
      done(result?.value)
    }
    socket.addEventListener('message', onMessage)
    socket.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true },
      }),
    )
  })
}

try {
  const target = await page()
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true })
    socket.addEventListener('error', fail, { once: true })
  })

  // The checks below read English words; the app follows the system's language, so pin it first.
  await evaluate(socket, "localStorage.setItem('prumo.locale', 'en'); location.reload(); true", 90)
  await sleep(1500)

  const environment = await evaluate(socket, 'window.prumo.environment()', 1)
  const projects = await evaluate(socket, 'window.prumo.projects.list()', 2)
  // The registry asked from the packaged app: the CLI in use, and whether a newer one exists.
  const cli = await evaluate(socket, 'window.prumo.cli.status()', 14)
  // Waits for the screen to have rendered the report rather than its loading state.
  let text = ''
  for (let attempt = 0; attempt < 20 && !text.includes('Projects'); attempt++) {
    text = await evaluate(socket, 'document.body.innerText', 10 + attempt)
    if (!text.includes('Projects')) await sleep(250)
  }

  // Creating for real, through the packaged app: the embedded CLI, `pnpm install` and the list, in one go.
  const parent = mkdtempSync(join(tmpdir(), 'prumo-desktop-smoke-'))
  const created = await evaluate(
    socket,
    `window.prumo.projects.create(${JSON.stringify({
      parent,
      name: 'smoke-web',
      types: ['web'],
      architecture: 'alone',
      multiTenant: false,
      mcp: false,
      email: false,
      social: [],
    })})`,
    3,
  )
  const listed = await evaluate(socket, 'window.prumo.projects.list()', 4)

  // Running an app for real: a pseudo terminal in the packaged app, a port taken, and the port freed on stop.
  const run = {
    ready: false,
    port: 0,
    portWhileRunning: false,
    portAfterStop: true,
    screenHasUrl: false,
    portCheck: undefined,
  }

  if (created?.ok) {
    const id = `${created.project.path}#dev`
    // The port first, as the screen does. A port in use is moved, never freed: the smoke must not stop
    // something of the user's that happens to hold 5173.
    const project = JSON.stringify(created.project)
    run.portCheck = await evaluate(socket, `window.prumo.apps.checkPort(${project}, 'web')`, 12)
    if (run.portCheck?.code === 'port_busy') {
      run.portCheck = await evaluate(
        socket,
        `window.prumo.apps.checkPort(${project}, 'web', 'change')`,
        13,
      )
    }
    await evaluate(
      socket,
      `window.prumo.apps.start(${JSON.stringify({ project: created.project.path, script: 'dev' })})`,
      6,
    )

    for (let attempt = 0; attempt < 60 && !run.ready; attempt++) {
      const buffer = await evaluate(
        socket,
        `window.prumo.apps.buffer(${JSON.stringify(id)})`,
        100 + attempt,
      )
      // A terminal buffer is coloured, and the escapes cut through words: even `localhost:5173` arrives as
      // `localhost:<escape>5173`. Anything matched against it has to be stripped first.
      const plain = typeof buffer === 'string' ? buffer.replaceAll(ANSI, '') : ''
      // The port comes from what the dev server printed: it is 5173 unless the check moved the app.
      run.port = Number(plain.match(/localhost:(\d+)/)?.[1])
      run.ready = Number.isInteger(run.port)
      if (!run.ready) await sleep(1000)
    }

    run.portWhileRunning = run.ready && (await portHeld(run.port))

    // The project screen, with the app running: the address button comes from what the app printed.
    await evaluate(
      socket,
      `window.location.hash = '#/project?path=' + encodeURIComponent(${JSON.stringify(created.project.path)})`,
      11,
    )
    for (let attempt = 0; attempt < 20 && !run.screenHasUrl; attempt++) {
      const screen = await evaluate(socket, 'document.body.innerText', 200 + attempt)
      run.screenHasUrl = typeof screen === 'string' && screen.includes(`Open localhost:${run.port}`)
      if (!run.screenHasUrl) await sleep(500)
    }

    await evaluate(socket, `window.prumo.apps.stop(${JSON.stringify(id)})`, 7)
    await sleep(1500)
    run.portAfterStop = run.ready && (await portHeld(run.port))
    run.state = await evaluate(
      socket,
      `(async () => (await window.prumo.apps.list()).find((one) => one.id === ${JSON.stringify(id)}))()`,
      8,
    )
  }

  // The knowledge base, read through the same bridge the screen uses, and the refusal that guards it.
  // Read while the project still exists: everything below deletes it.
  const docs = created?.ok
    ? {
        index: await evaluate(
          socket,
          `window.prumo.docs.read(${JSON.stringify(created.project.path)})`,
          9,
        ),
        outside: await evaluate(
          socket,
          `window.prumo.docs.read(${JSON.stringify(created.project.path)}, '../package.json')`,
          10,
        ),
      }
    : {}

  if (created?.ok) {
    await evaluate(
      socket,
      `window.prumo.projects.remove(${JSON.stringify(created.project.path)})`,
      5,
    )
  }
  rmSync(parent, { recursive: true, force: true })

  const failures = []
  if (environment?.node === undefined)
    failures.push("the app found no Node with the desktop's PATH")
  if (!Array.isArray(environment?.checks) || environment.checks.length === 0) {
    failures.push('`prumo doctor` returned no checks')
  }
  if (typeof cli?.version !== 'string') failures.push('the CLI status named no version')
  if (cli?.error !== undefined) failures.push(`the npm registry could not be asked: ${cli.error}`)
  if (!Array.isArray(projects)) failures.push('the projects bridge answered nothing')
  if (created?.ok !== true) failures.push(`creating a project failed: ${JSON.stringify(created)}`)
  if (!listed?.some((one) => one.name === 'smoke-web')) {
    failures.push('the created project did not reach the list')
  }
  if (run.portCheck?.ok !== true) {
    failures.push(`the port check did not clear the way: ${JSON.stringify(run.portCheck)}`)
  }
  if (!run.ready) failures.push('the app never reported a dev server in its terminal')
  if (!run.portWhileRunning) failures.push(`nothing was listening on ${run.port} while the app ran`)
  if (run.portAfterStop) failures.push(`port ${run.port} was still held after stopping the app`)
  if (!run.screenHasUrl) failures.push('the project screen offered no address to open')
  if (!docs.index?.ok || !docs.index.text.includes('#'))
    failures.push('.prumo/INDEX.md was not read')
  if (docs.outside?.ok !== false) failures.push('a document outside .prumo/ was readable')
  if (!text.includes('Projects')) failures.push('the window rendered nothing')

  console.log(
    JSON.stringify(
      {
        environment,
        cli,
        projects,
        created,
        run,
        docs: {
          index: docs.index?.ok,
          indexProblem: docs.index?.message,
          outside: docs.outside?.ok,
        },
        screen: text.split('\n').filter(Boolean),
      },
      null,
      2,
    ),
  )

  // The language pinned above belongs to the user, not to this check.
  await evaluate(socket, "localStorage.removeItem('prumo.locale'); true", 91)

  if (failures.length > 0) {
    console.error(`\nSmoke failed:\n- ${failures.join('\n- ')}\n\nThe app's own output:\n${log}`)
    process.exitCode = 1
  } else {
    console.log("\nSmoke passed: packaged app, the desktop's PATH, bridge and screen.")
  }
} finally {
  child.kill('SIGTERM')
}
