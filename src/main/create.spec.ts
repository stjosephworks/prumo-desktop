// Against the real CLI, creating real projects: what the Desktop must not get wrong is the contract with it.
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { createProject } from './create.ts'
import { Projects } from './projects.ts'

const cli = join(import.meta.dirname, '..', '..', 'resources', 'prumo', 'dist', 'cli.js')

let projects: Projects
let parent = ''

beforeEach(() => {
  projects = new Projects(
    join(mkdtempSync(join(tmpdir(), 'prumo-desktop-store-')), 'projects.json'),
  )
  parent = mkdtempSync(join(tmpdir(), 'prumo-desktop-parent-'))
})

test('creates a project, and it is in the list without anyone adding it', async () => {
  let log = ''

  const result = await createProject(
    { parent, name: 'spec-web', types: ['web'], architecture: 'alone', multiTenant: false },
    projects,
    { cli, onLog: (chunk) => (log += chunk) },
  )

  expect(result.ok).toBe(true)
  if (!result.ok) return

  expect(existsSync(join(parent, 'spec-web', '.prumo', 'config.json'))).toBe(true)
  expect(result.project.config).toEqual({
    types: ['web'],
    architecture: 'alone',
    multiTenant: false,
  })
  expect(projects.list().map((one) => one.path)).toEqual([result.project.path])
  // The log is what a person would have seen in a terminal: it is stderr, never the document.
  expect(log).not.toBe('')
  expect(log).not.toContain('"ok":')
}, 300_000)

test('an invalid name comes back as invalid_input, with the CLI’s message', async () => {
  const result = await createProject(
    { parent, name: 'Bad Name', types: ['web'], architecture: 'alone', multiTenant: false },
    projects,
    { cli },
  )

  expect(result).toMatchObject({ ok: false, code: 'invalid_input' })
  if (!result.ok) expect(result.message).toContain('Bad Name')
  expect(projects.list()).toHaveLength(0)
})

test('an occupied folder comes back as target_not_empty', async () => {
  mkdirSync(join(parent, 'taken'))
  writeFileSync(join(parent, 'taken', 'something.txt'), 'not empty')

  const result = await createProject(
    { parent, name: 'taken', types: ['web'], architecture: 'alone', multiTenant: false },
    projects,
    { cli },
  )

  expect(result).toMatchObject({ ok: false, code: 'target_not_empty' })
})
