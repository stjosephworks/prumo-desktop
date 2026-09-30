import { expect, test } from 'vitest'
import { allowsAlone, asksMcp, asksTenancy } from './questions.ts'

test('tenancy is asked unless the project is only a site', () => {
  expect(asksTenancy(['site'])).toBe(false)
  expect(asksTenancy(['site', 'mobile'])).toBe(true)
  expect(asksTenancy(['api'])).toBe(true)
})

test('MCP is asked only with both api and web', () => {
  expect(asksMcp(['api', 'web'])).toBe(true)
  expect(asksMcp(['api', 'mobile'])).toBe(false)
  expect(asksMcp(['web'])).toBe(false)
})

test('alone is allowed for one type only', () => {
  expect(allowsAlone(['web'])).toBe(true)
  expect(allowsAlone(['api', 'web'])).toBe(false)
})
