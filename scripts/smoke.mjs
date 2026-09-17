// Checks a packaged build the way a user gets it, without a human watching.
//
//   pnpm package && node scripts/smoke.mjs
//
// It starts the app with the environment an app opened from Finder receives (launchd's PATH, nothing else),
// then asks the renderer itself what the bridge returned and what the window shows. The app is closed at the end.
// Anything that needs a native dialog, such as adding a folder, is not reachable from here on purpose.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FINDER_PATH = '/usr/bin:/bin:/usr/sbin:/sbin'
const PORT = 9333

const out = join(import.meta.dirname, '..', 'out')
const bundle = readdirSync(out).find((entry) => entry.startsWith('Prumo Desktop-'))

if (bundle === undefined) throw new Error('No packaged app in out/. Run `pnpm package` first.')

const binary = join(out, bundle, 'Prumo Desktop.app', 'Contents', 'MacOS', 'Prumo Desktop')

if (!existsSync(binary)) throw new Error(`No binary at ${binary}`)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function portHeld(port) {
  try {
    execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
    return true
  } catch {
    return false
  }
}

// `env -i` on purpose: inheriting this shell's PATH would hide exactly the bug fix-path exists for.
const child = spawn(binary, [`--remote-debugging-port=${PORT}`], {
  env: { PATH: FINDER_PATH, HOME: process.env.HOME },
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

  const environment = await evaluate(socket, 'window.prumo.environment()', 1)
  const projects = await evaluate(socket, 'window.prumo.projects.list()', 2)
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
    })})`,
    3,
  )
  const listed = await evaluate(socket, 'window.prumo.projects.list()', 4)

  // Running an app for real: a pseudo terminal in the packaged app, a port taken, and the port freed on stop.
  const run = { ready: false, portWhileRunning: false, portAfterStop: true }

  if (created?.ok) {
    const id = `${created.project.path}#dev`
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
      const plain =
        typeof buffer === 'string' ? buffer.replaceAll(/\u001b\[[0-9;?]*[a-zA-Z]/g, '') : ''
      run.ready = /localhost:\d+/.test(plain)
      if (!run.ready) await sleep(1000)
    }

    run.portWhileRunning = portHeld(5173)
    await evaluate(socket, `window.prumo.apps.stop(${JSON.stringify(id)})`, 7)
    await sleep(1500)
    run.portAfterStop = portHeld(5173)
    run.state = await evaluate(
      socket,
      `(async () => (await window.prumo.apps.list()).find((one) => one.id === ${JSON.stringify(id)}))()`,
      8,
    )
  }

  if (created?.ok) {
    await evaluate(
      socket,
      `window.prumo.projects.remove(${JSON.stringify(created.project.path)})`,
      5,
    )
  }
  rmSync(parent, { recursive: true, force: true })

  const failures = []
  if (environment?.node === undefined) failures.push('the app found no Node with the Finder PATH')
  if (!Array.isArray(environment?.checks) || environment.checks.length === 0) {
    failures.push('`prumo doctor` returned no checks')
  }
  if (!Array.isArray(projects)) failures.push('the projects bridge answered nothing')
  if (created?.ok !== true) failures.push(`creating a project failed: ${JSON.stringify(created)}`)
  if (!listed?.some((one) => one.name === 'smoke-web')) {
    failures.push('the created project did not reach the list')
  }
  if (!run.ready) failures.push('the app never reported a dev server in its terminal')
  if (!run.portWhileRunning) failures.push('nothing was listening on 5173 while the app ran')
  if (run.portAfterStop) failures.push('port 5173 was still held after stopping the app')
  if (!text.includes('Projects')) failures.push('the window rendered nothing')

  console.log(
    JSON.stringify(
      { environment, projects, created, run, screen: text.split('\n').filter(Boolean) },
      null,
      2,
    ),
  )

  if (failures.length > 0) {
    console.error(`\nSmoke failed:\n- ${failures.join('\n- ')}`)
    process.exitCode = 1
  } else {
    console.log('\nSmoke passed: packaged app, Finder PATH, bridge and screen.')
  }
} finally {
  child.kill('SIGTERM')
}
