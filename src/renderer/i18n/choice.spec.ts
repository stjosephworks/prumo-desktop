import { expect, test } from 'vitest'
import { choiceOf, FOLLOW_SYSTEM, localeOf } from './choice.ts'

test('following the system shows as that option, not as the language it resolved to', () => {
  expect(choiceOf({ locale: 'pt', chosen: false })).toBe(FOLLOW_SYSTEM)
  expect(choiceOf({ locale: 'es', chosen: true })).toBe('es')
})

test('the follow-the-system option asks for no language, so the choice is forgotten', () => {
  expect(localeOf(FOLLOW_SYSTEM)).toBeUndefined()
  expect(localeOf('pt')).toBe('pt')
  expect(localeOf('fr')).toBeUndefined()
})
