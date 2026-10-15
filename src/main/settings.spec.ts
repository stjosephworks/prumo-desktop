import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { Settings } from './settings.ts'

test('a chosen Node is kept across launches, and a missing file reads as nothing chosen', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'prumo-desktop-settings-')), 'settings.json')

  expect(new Settings(file).read()).toEqual({})
  new Settings(file).write({ node: 'C:\\Tools\\node.exe' })
  expect(new Settings(file).read()).toEqual({ node: 'C:\\Tools\\node.exe' })
})
