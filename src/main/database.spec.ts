// A real project, a real Docker container: the database part is where the Desktop can least afford to guess.
// Skipped when Docker is not running, because then there is nothing true to check.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { Project } from '../shared/ipc.ts'
import { createProject } from './create.ts'
import {
  createDatabase,
  databaseState,
  dockerState,
  openDocker,
  startDocker,
  stopDocker,
} from './database.ts'
import { Projects } from './projects.ts'

const cli = join(import.meta.dirname, '..', '..', 'resources', 'prumo', 'dist', 'cli.js')

function dockerRunning(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const whenDocker = dockerRunning() ? test : test.skip

let parent = ''
let project: Project

beforeAll(async () => {
  if (!dockerRunning()) return

  parent = mkdtempSync(join(tmpdir(), 'prumo-desktop-db-'))
  const projects = new Projects(join(parent, 'projects.json'))
  const result = await createProject(
    {
      parent,
      name: 'spec-api',
      types: ['api'],
      architecture: 'alone',
      multiTenant: false,
      mcp: false,
      email: false,
      social: [],
    },
    projects,
    { cli },
  )

  if (!result.ok) throw new Error(`could not create the project: ${result.message}`)

  project = result.project
}, 600_000)

afterAll(() => {
  if (project !== undefined) {
    // The database keeps running when the Desktop quits; a test must not leave one behind.
    execFileSync('docker', ['compose', 'down', '-v'], { cwd: project.path, stdio: 'ignore' })
  }
  if (parent !== '') rmSync(parent, { recursive: true, force: true })
}, 120_000)

whenDocker('a new project has the database part, and no database yet', async () => {
  expect(await databaseState(project, { cli })).toEqual({ part: true, created: false })
})

whenDocker('a project without an API has no database part', async () => {
  const none: Project = {
    path: '/tmp/none',
    name: 'none',
    found: true,
    config: {
      types: ['web'],
      architecture: 'alone',
      multiTenant: false,
      mcp: false,
      email: false,
      social: [],
    },
  }

  expect(await databaseState(none, { cli })).toEqual({ part: false })
  expect(await dockerState(none)).toEqual({ part: false })
})

whenDocker(
  'creating the database makes it exist, run in Docker, and stop when asked',
  async () => {
    const created = await createDatabase(project, 'spec_api', { cli })
    expect(created).toMatchObject({ ok: true, database: 'spec_api', created: true, migrated: true })

    expect(await databaseState(project, { cli })).toEqual({ part: true, created: true })

    const running = await dockerState(project)
    expect(running).toMatchObject({ part: true, docker: 'running' })
    if (running.part) expect(running.services.some((one) => one.state === 'running')).toBe(true)
    // The port Docker publishes is the one the command chose.
    if (running.part && created.ok) {
      expect(running.services.find((one) => one.port !== undefined)?.port).toBe(created.port)
    }

    expect(await stopDocker(project)).toBe(true)
    const stopped = await dockerState(project)
    if (stopped.part) expect(stopped.services.every((one) => one.state !== 'running')).toBe(true)

    expect(await startDocker(project)).toBe(true)
    const again = await dockerState(project)
    if (again.part) expect(again.services.some((one) => one.state === 'running')).toBe(true)
  },
  600_000,
)

// Docker is already running here, so opening it again is a no-op that must still report an engine that answers.
whenDocker('opening Docker resolves once its engine answers', async () => {
  expect(await openDocker(10_000)).toBe(process.platform === 'darwin')
})
