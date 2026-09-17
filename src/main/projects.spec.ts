import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { NotAProject, Projects } from './projects.ts'

let store = ''

beforeEach(() => {
  store = join(mkdtempSync(join(tmpdir(), 'prumo-desktop-store-')), 'projects.json')
})

/** A folder that looks to the Desktop exactly like one `prumo new` wrote. */
function project(config: Record<string, unknown> = {}): string {
  const path = mkdtempSync(join(tmpdir(), 'prumo-desktop-project-'))

  mkdirSync(join(path, '.prumo'))
  writeFileSync(
    join(path, '.prumo', 'config.json'),
    JSON.stringify({
      types: ['api', 'web'],
      architecture: 'monorepo',
      multiTenant: false,
      ...config,
    }),
  )

  return path
}

test('adds a folder and reads what the project says about itself', () => {
  const projects = new Projects(store)
  const path = project({ types: ['api'], architecture: 'alone' })

  const added = projects.add(path)

  expect(added.found).toBe(true)
  expect(added.config).toEqual({ types: ['api'], architecture: 'alone', multiTenant: false })
  expect(projects.list()).toHaveLength(1)
})

test('refuses a folder that is not a Prumo project', () => {
  const projects = new Projects(store)

  expect(() => projects.add(mkdtempSync(join(tmpdir(), 'plain-folder-')))).toThrow(NotAProject)
  expect(projects.list()).toHaveLength(0)
})

test('adding the same project twice keeps one entry', () => {
  const projects = new Projects(store)
  const path = project()

  projects.add(path)
  projects.add(path)

  expect(projects.list()).toHaveLength(1)
})

test('the list survives a restart, and is read from disk again', () => {
  const path = project()
  new Projects(store).add(path)

  const reopened = new Projects(store).list()

  expect(reopened.map((one) => one.path)).toEqual([path])
})

test('a project whose folder is gone is shown as not found, and only the user removes it', () => {
  const projects = new Projects(store)
  const path = project()
  projects.add(path)

  rmSync(path, { recursive: true, force: true })

  const [entry] = projects.list()
  expect(entry?.found).toBe(false)
  expect(entry?.config).toBeUndefined()
  expect(projects.list()).toHaveLength(1)

  projects.remove(path)
  expect(projects.list()).toHaveLength(0)
})

test('a project that changed on disk is read again, not remembered', () => {
  const projects = new Projects(store)
  const path = project({ types: ['api'] })
  projects.add(path)

  writeFileSync(
    join(path, '.prumo', 'config.json'),
    JSON.stringify({ types: ['api', 'mobile'], architecture: 'monorepo', multiTenant: true }),
  )

  expect(projects.list()[0]?.config).toEqual({
    types: ['api', 'mobile'],
    architecture: 'monorepo',
    multiTenant: true,
  })
})
