// Real processes, no mocks: a process layer that passes against a fake proves nothing about ports being freed.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Apps, appId, processTree } from './processes.ts'

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

function portHeld(port: number): boolean {
  try {
    execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
    return true
  } catch {
    return false
  }
}

function waitFor(condition: () => boolean, timeoutMs = 30_000): Promise<void> {
  return new Promise((done, fail) => {
    const started = Date.now()
    const tick = () => {
      if (condition()) return done()
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
  expect(portHeld(PORT)).toBe(true)

  const tree = processTree(processTreeRoot(apps, started.id))
  expect(tree.length).toBeGreaterThan(1)

  const stopped = await apps.stop(started.id)
  expect(stopped?.state).toBe('stopped')
  expect(portHeld(PORT)).toBe(false)
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

  expect(portHeld(PORT)).toBe(false)
  expect(apps.get(started.id)?.state).toBe('stopped')
})

/** The pseudo terminal's own pid, which is the group leader. */
function processTreeRoot(instance: Apps, id: string): number {
  const entries = instance as unknown as { entries: Map<string, { terminal: { pid: number } }> }
  const entry = entries.entries.get(id)

  if (entry === undefined) throw new Error(`no app ${id}`)

  return entry.terminal.pid
}
