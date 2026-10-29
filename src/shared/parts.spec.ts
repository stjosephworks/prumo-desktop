import { expect, test } from 'vitest'
import type { Project } from './ipc.ts'
import { apiDirectory, appDirectory, folderName, partsFor } from './parts.ts'

const project = (config: Project['config']): Project => ({
  path: '/tmp/example',
  name: 'example',
  found: true,
  config,
})

test('a workspace has one part per type, each with its own root script', () => {
  const parts = partsFor(
    project({
      types: ['api', 'web', 'mobile'],
      architecture: 'monorepo',
      multiTenant: false,
      mcp: false,
      signIn: ['password'],
      email: false,
      social: [],
    }),
  )

  expect(parts).toEqual([
    { name: 'api', type: 'api', script: 'api' },
    { name: 'web', type: 'web', script: 'web' },
    { name: 'mobile', type: 'mobile', script: 'mobile' },
  ])
})

test('an alone project is one part, started by pnpm dev', () => {
  const parts = partsFor(
    project({
      types: ['web'],
      architecture: 'alone',
      multiTenant: false,
      mcp: false,
      signIn: ['password'],
      email: false,
      social: [],
    }),
  )

  expect(parts).toEqual([{ name: 'web', type: 'web', script: 'dev' }])
})

test('a workspace whose apps were named on purpose has one part per app, found under its name', () => {
  const named = project({
    types: ['api', 'web'],
    apps: [
      { name: 'server', type: 'api' },
      { name: 'web', type: 'web' },
      { name: 'backoffice', type: 'web' },
    ],
    architecture: 'monorepo',
    multiTenant: false,
    mcp: false,
    signIn: ['password'],
    email: false,
    social: [],
  })
  const parts = partsFor(named)

  expect(parts.map((part) => [part.name, part.type, part.script])).toEqual([
    ['server', 'api', 'server'],
    ['web', 'web', 'web'],
    ['backoffice', 'web', 'backoffice'],
  ])
  expect(parts.map((part) => appDirectory(named, part))).toEqual([
    '/tmp/example/apps/server',
    '/tmp/example/apps/web',
    '/tmp/example/apps/backoffice',
  ])
  expect(apiDirectory(named)).toBe('/tmp/example/apps/server')
})

test('a project that was not found has no parts to show', () => {
  expect(partsFor({ path: '/gone', name: 'gone', found: false })).toEqual([])
})

test('a folder name comes from either separator', () => {
  expect(folderName('/Users/someone/code/shop')).toBe('shop')
  expect(folderName('C:\\Users\\someone\\code\\shop')).toBe('shop')
  expect(folderName('/Users/someone/code/shop/')).toBe('shop')
})
