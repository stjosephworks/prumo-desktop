import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { resolveLocale } from '../shared/locales.ts'
import { Settings } from './settings.ts'

const settingsFile = () =>
  join(mkdtempSync(join(tmpdir(), 'prumo-desktop-settings-')), 'settings.json')

test('a chosen Node is kept across launches, and a missing file reads as nothing chosen', () => {
  const file = settingsFile()

  expect(new Settings(file).read()).toEqual({})
  new Settings(file).write({ node: 'C:\\Tools\\node.exe' })
  expect(new Settings(file).read()).toEqual({ node: 'C:\\Tools\\node.exe' })
})

test('a chosen language is kept across launches, beside the Node, and overrides the system', () => {
  const file = settingsFile()
  new Settings(file).write({ node: '/opt/node/bin/node' })
  new Settings(file).write({ locale: 'es' })

  const stored = new Settings(file).read()
  expect(stored).toEqual({ node: '/opt/node/bin/node', locale: 'es' })
  // A Mac set to Brazilian Portuguese still opens in the Spanish the user picked.
  expect(resolveLocale(stored.locale, ['pt-BR', 'en-US'])).toBe('es')
})

test('forgetting the language goes back to the system', () => {
  const file = settingsFile()
  new Settings(file).write({ locale: 'pt' })
  new Settings(file).write({ locale: undefined })

  const stored = new Settings(file).read()
  expect(stored).toEqual({})
  expect(resolveLocale(stored.locale, ['es-MX'])).toBe('es')
})

test('a language the app does not speak, written by hand, reads as none chosen', () => {
  const file = settingsFile()
  writeFileSync(file, JSON.stringify({ locale: 'fr', node: 42 }))

  expect(new Settings(file).read()).toEqual({})
})
