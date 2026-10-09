// Against a project the real CLI generated, and a real process holding the port.
import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, expect, test } from 'vitest'
import type { Project } from '../shared/ipc.ts'
import { runCli } from './cli.ts'
import { checkPort } from './ports.ts'

const cli = join(import.meta.dirname, '..', '..', 'resources', 'prumo', 'dist', 'cli.js')

let project: Project
let holder: ChildProcess | undefined

/** A port nothing holds right now, asked of the system rather than guessed. */
function freePort(): Promise<number> {
  return new Promise((done) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => done(typeof address === 'object' && address !== null ? address.port : 0))
    })
  })
}

/** Another process, not this one, holding the port: `kill` must be able to stop it. */
function hold(port: number): Promise<ChildProcess> {
  const child = spawn(process.execPath, [
    '-e',
    `require('node:net').createServer().listen(${port}, '127.0.0.1', () => console.log('ready'))`,
  ])

  return new Promise((done) => child.stdout.once('data', () => done(child)))
}

function webPort(): string | undefined {
  return /^WEB_PORT=(.*)$/m.exec(readFileSync(join(project.path, '.env'), 'utf8'))?.[1]
}

function setWebPort(port: number): void {
  const env = join(project.path, '.env')
  writeFileSync(env, readFileSync(env, 'utf8').replace(/^WEB_PORT=.*$/m, `WEB_PORT=${port}`))
}

beforeAll(async () => {
  const parent = mkdtempSync(join(tmpdir(), 'prumo-desktop-ports-'))
  // ports.mjs is plain Node, so the project needs no install to answer.
  await runCli(
    ['new', 'spec-ports', '--types', 'web', '--alone', '--single-tenant', '--skip-install'],
    {
      cli,
      cwd: parent,
    },
  )
  project = {
    path: join(parent, 'spec-ports'),
    name: 'spec-ports',
    found: true,
    config: { types: ['web'], architecture: 'alone', multiTenant: false, mcp: false },
  }
})

afterEach(() => {
  holder?.kill('SIGKILL')
  holder = undefined
})

test('a free port lets the app start, on the port the script settled', async () => {
  const port = await freePort()
  setWebPort(port)

  // The port the app will start on, as the script settled it.
  expect(await checkPort(project, 'web')).toEqual({ ok: true, port })
})

test('a port in use comes back as port_busy, naming what holds it', async () => {
  const port = await freePort()
  setWebPort(port)
  holder = await hold(port)

  const check = await checkPort(project, 'web')

  expect(check).toMatchObject({ ok: false, code: 'port_busy' })
  if (!check.ok) expect(check.message).toContain(String(port))
})

test('change moves the app to a free port, written to its .env', async () => {
  const port = await freePort()
  setWebPort(port)
  holder = await hold(port)

  expect(await checkPort(project, 'web', 'change')).toMatchObject({ ok: true })
  expect(webPort()).not.toBe(String(port))
})

test('kill stops what held the port, and the app keeps its port', async () => {
  const port = await freePort()
  setWebPort(port)
  const held = await hold(port)
  holder = held
  const exited = new Promise((done) => held.once('exit', done))

  expect(await checkPort(project, 'web', 'kill')).toEqual({ ok: true, port })
  await exited
  expect(webPort()).toBe(String(port))
})

test('a project without scripts/ports.mjs, from an older CLI, is not checked', async () => {
  const old: Project = { ...project, path: mkdtempSync(join(tmpdir(), 'prumo-desktop-old-')) }

  expect(await checkPort(old, 'web')).toEqual({ ok: true })
})
