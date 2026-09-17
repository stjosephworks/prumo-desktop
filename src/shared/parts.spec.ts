import { expect, test } from 'vitest'
import type { Project } from './ipc.ts'
import { partsFor } from './parts.ts'

const project = (config: Project['config']): Project => ({
  path: '/tmp/example',
  name: 'example',
  found: true,
  config,
})

test('a workspace has one part per type, each with its own root script', () => {
  const parts = partsFor(
    project({ types: ['api', 'web', 'mobile'], architecture: 'monorepo', multiTenant: false }),
  )

  expect(parts).toEqual([
    { type: 'api', script: 'api' },
    { type: 'web', script: 'web' },
    { type: 'mobile', script: 'mobile' },
  ])
})

test('an alone project is one part, started by pnpm dev', () => {
  const parts = partsFor(project({ types: ['web'], architecture: 'alone', multiTenant: false }))

  expect(parts).toEqual([{ type: 'web', script: 'dev' }])
})

test('a project that was not found has no parts to show', () => {
  expect(partsFor({ path: '/gone', name: 'gone', found: false })).toEqual([])
})
