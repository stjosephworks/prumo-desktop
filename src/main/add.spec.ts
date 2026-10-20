// Against the real CLI, on a real workspace: the contract with `prumo add` is what the Desktop must not get wrong.
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, expect, test } from 'vitest'
import { addApp } from './add.ts'
import { runCli } from './cli.ts'
import { Projects } from './projects.ts'

const cli = join(import.meta.dirname, '..', '..', 'resources', 'prumo', 'dist', 'cli.js')

let projects: Projects
let path = ''

beforeAll(async () => {
  const parent = mkdtempSync(join(tmpdir(), 'prumo-desktop-add-'))
  const flags = ['--monorepo', '--single-tenant', '--no-mcp', '--no-email', '--no-social']

  await runCli(['new', 'spec-add', '--types', 'api,web', ...flags, '--skip-install'], {
    cli,
    cwd: parent,
  })
  path = join(parent, 'spec-add')
  projects = new Projects(join(parent, 'projects.json'))
  projects.add(path)
}, 120_000)

test('adds a second web app, and the project read again lists it', async () => {
  const result = await addApp(path, { type: 'web', name: 'backoffice' }, projects, { cli })

  expect(result).toMatchObject({ ok: true })
  if (!result.ok) return

  expect(result.project.config?.apps?.map((app) => app.name)).toEqual(['api', 'web', 'backoffice'])
  expect(existsSync(join(path, 'apps', 'backoffice', 'package.json'))).toBe(true)
}, 600_000)

test('a name the CLI refuses comes back as invalid_app, with its message', async () => {
  const result = await addApp(path, { type: 'site', name: 'docs' }, projects, { cli })

  expect(result).toMatchObject({ ok: false, code: 'invalid_app' })
  if (!result.ok) expect(result.message).toContain('docs')
  expect(existsSync(join(path, 'apps', 'docs'))).toBe(false)
})
