import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { Language } from './language.ts'
import { Settings } from './settings.ts'

function language(preferred: string[], fallback = '') {
  const file = join(mkdtempSync(join(tmpdir(), 'prumo-desktop-language-')), 'settings.json')
  return { file, language: new Language(new Settings(file), () => ({ preferred, fallback })) }
}

test('with nothing chosen, the system answers', () => {
  expect(language(['fr-FR', 'pt-BR']).language.state()).toEqual({ locale: 'pt', chosen: false })
})

test('a choice overrides the system, and is kept in settings.json', () => {
  const { file, language: one } = language(['pt-BR'])

  expect(one.choose('es')).toEqual({ locale: 'es', chosen: true })
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ locale: 'es' })
})

test('following the system again removes the choice from settings.json, and the system answers', () => {
  const { file, language: one } = language(['es-MX'])
  one.choose('en')

  expect(one.choose(undefined)).toEqual({ locale: 'es', chosen: false })
  expect(JSON.parse(readFileSync(file, 'utf8'))).not.toHaveProperty('locale')
})
