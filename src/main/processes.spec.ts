// Real processes, no mocks: a process layer that passes against a fake proves nothing about ports being freed.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Apps, appId, endTree, processTree } from './processes.ts'

const PORT = 45_231

/** A project whose `pnpm <script>` starts a server that holds a port, through a shell, as pnpm does. */
function project(scripts: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'prumo-desktop-test-'))

  writeFileSync(
    join(directory, 'server.mjs'),
    `import { createServer } from 'node:http'
createServer((_request, response) => response.end('ok')).listen(${PORT}, () => {
  console.log('listening on ${PORT}')
})
// Ignoring SIGTERM proves the group is signalled, not only pnpm: a child that survives keeps the port.
process.on('SIGTERM', () => {})
`,
  )
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ name: 'fixture', private: true, scripts }),
  )

  return directory
}

/** Whether a port answers on either loopback address, asked over TCP: the same on every system, no lsof. */
async function portHeld(port: number): Promise<boolean> {
  const answers = (host: string) =>
    new Promise<boolean>((done) => {
      const socket = connect({ host, port })
      const finish = (open: boolean) => {
        socket.destroy()
        done(open)
      }
      socket.setTimeout(1_000, () => finish(false))
      socket.once('connect', () => finish(true))
      socket.once('error', () => finish(false))
    })

  return (await answers('127.0.0.1')) || (await answers('::1'))
}

function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 30_000): Promise<void> {
  return new Promise((done, fail) => {
    const started = Date.now()
    const tick = async () => {
      if (await condition()) return done()
      if (Date.now() - started > timeoutMs) return fail(new Error('timed out'))
      setTimeout(tick, 100)
    }
    tick()
  })
}

// A fresh instance per test: state left by one test would otherwise answer another test's question.
let apps = new Apps()

beforeEach(() => {
  apps = new Apps()
})

afterEach(async () => {
  await apps.stopAll()
})

test('starts an app, reports its output, and stops its whole process tree', async () => {
  const directory = project({ dev: 'node server.mjs' })
  let output = ''
  apps.on('output', (_id, data) => {
    output += data
  })

  const started = apps.start({ project: directory, script: 'dev' })
  expect(started.id).toBe(appId(directory, 'dev'))
  expect(started.state).toBe('starting')

  await waitFor(() => output.includes(`listening on ${PORT}`))
  expect(apps.get(started.id)?.state).toBe('running')
  expect(apps.buffer(started.id)).toContain('listening on')
  expect(await portHeld(PORT)).toBe(true)

  const tree = processTree(processTreeRoot(apps, started.id))
  expect(tree.length).toBeGreaterThan(1)

  const stopped = await apps.stop(started.id)
  expect(stopped?.state).toBe('stopped')
  expect(await portHeld(PORT)).toBe(false)
})

test('an app that exits with an error is failed, not stopped', async () => {
  const directory = project({ dev: 'node --eval "process.exit(3)"' })

  const started = apps.start({ project: directory, script: 'dev' })
  await waitFor(() => apps.get(started.id)?.state === 'failed')

  expect(apps.get(started.id)?.exitCode).toBe(3)
})

test('quitting stops everything that is still running', async () => {
  const directory = project({ dev: 'node server.mjs' })

  const started = apps.start({ project: directory, script: 'dev' })
  await waitFor(() => portHeld(PORT))

  await apps.stopAll()

  expect(await portHeld(PORT)).toBe(false)
  expect(apps.get(started.id)?.state).toBe('stopped')
})

/** The pseudo terminal's own pid: the group leader on macOS and Linux, cmd.exe on Windows. */
function processTreeRoot(instance: Apps, id: string): number {
  const entries = instance as unknown as { entries: Map<string, { terminal: { pid: number } }> }
  const entry = entries.entries.get(id)

  if (entry === undefined) throw new Error(`no app ${id}`)

  return entry.terminal.pid
}

test('ending a tree ends the process and what it started', async () => {
  const { spawn } = await import('node:child_process')
  const parent = spawn(
    process.execPath,
    [
      '-e',
      `const c = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); console.log(c.pid); setInterval(() => {}, 1000)`,
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  )
  const child = await new Promise<number>((done) =>
    parent.stdout.once('data', (chunk: Buffer) => done(Number(chunk.toString().trim()))),
  )
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  expect(alive(child)).toBe(true)

  endTree(parent.pid ?? 0)

  await waitFor(() => !alive(child) && !alive(parent.pid ?? 0))
}, 60_000)
