import { createRequire } from 'node:module'
import { expect, test } from 'vitest'
import { updaterEnabled } from './updates.ts'

const { signingMode } = createRequire(import.meta.url)('../../build/signing.cjs') as {
  signingMode: (env: Record<string, string | undefined>) => 'developer-id' | 'ad-hoc'
}

const all = {
  APPLE_ID: 'someone@example.com',
  APPLE_PASSWORD: 'app-specific',
  APPLE_TEAM_ID: 'ABCDE12345',
}

test('all three notarization variables make a Developer ID build', () => {
  expect(signingMode(all)).toBe('developer-id')
})

test('none of them makes an ad-hoc build, and GitHub passes a missing secret as an empty string', () => {
  expect(signingMode({})).toBe('ad-hoc')
  expect(signingMode({ APPLE_ID: '', APPLE_PASSWORD: '', APPLE_TEAM_ID: '' })).toBe('ad-hoc')
})

test('only some of them is an error naming what is missing, never a quiet ad-hoc build', () => {
  expect(() => signingMode({ ...all, APPLE_TEAM_ID: '' })).toThrow('Missing: APPLE_TEAM_ID.')
  expect(() => signingMode({ APPLE_ID: all.APPLE_ID })).toThrow(
    'Missing: APPLE_PASSWORD, APPLE_TEAM_ID.',
  )
})

test('only a packaged Developer ID build starts the updater', () => {
  expect(updaterEnabled({ packaged: true, developerId: true })).toBe(true)
  expect(updaterEnabled({ packaged: true, developerId: false })).toBe(false)
  expect(updaterEnabled({ packaged: false, developerId: true })).toBe(false)
})
