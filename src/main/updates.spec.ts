import { createRequire } from 'node:module'
import { expect, test } from 'vitest'
import { noticeEnabled, signedBuild, updaterEnabled } from './updates.ts'

const { prerelease, signingMode } = createRequire(import.meta.url)('../../build/signing.cjs') as {
  prerelease: (mode: 'developer-id' | 'ad-hoc') => boolean
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

const mac = { packaged: true, platform: 'darwin' as const, developerId: true }

test('only a packaged macOS build signed with a Developer ID starts the updater', () => {
  expect(updaterEnabled(mac)).toBe(true)
  expect(updaterEnabled({ ...mac, developerId: false })).toBe(false)
  expect(updaterEnabled({ ...mac, packaged: false })).toBe(false)
  // Linux has no updater in Electron, and the Windows Setup.exe is unsigned.
  expect(updaterEnabled({ ...mac, platform: 'linux' })).toBe(false)
  expect(updaterEnabled({ ...mac, platform: 'win32' })).toBe(false)
})

test('every other packaged build shows the notice instead', () => {
  expect(noticeEnabled(mac, {})).toBe(false)
  expect(noticeEnabled({ ...mac, developerId: false }, {})).toBe(true)
  expect(noticeEnabled({ ...mac, platform: 'linux', developerId: false }, {})).toBe(true)
  expect(noticeEnabled({ ...mac, platform: 'win32', developerId: false }, {})).toBe(true)
})

test('the notice is off in development, unless asked for', () => {
  const dev = { packaged: false, platform: 'linux' as const, developerId: false }

  expect(noticeEnabled(dev, {})).toBe(false)
  expect(noticeEnabled(dev, { PRUMO_UPDATE_NOTICE: '1' })).toBe(true)
})

test('only a Developer ID build counts as signed, so every other one is offered pre-releases', () => {
  expect(signedBuild(mac)).toBe(true)
  expect(signedBuild({ ...mac, developerId: false })).toBe(false)
  expect(signedBuild({ ...mac, platform: 'linux' })).toBe(false)
})

test('a release is a pre-release while macOS is ad-hoc, and a normal one once it is signed', () => {
  expect(prerelease('ad-hoc')).toBe(true)
  expect(prerelease('developer-id')).toBe(false)
})

test('the notice agrees: a signed Mac skips pre-releases, every unsigned build is offered them', () => {
  const signed = { packaged: true, platform: 'darwin' as const, developerId: true }

  // A signed Mac reads only what a Developer ID release is: a normal release.
  expect(signedBuild(signed)).toBe(!prerelease('developer-id'))
  // An ad-hoc Mac and Linux are offered pre-releases, so the ad-hoc previews reach them as well.
  expect(signedBuild({ ...signed, developerId: false })).toBe(!prerelease('ad-hoc'))
  expect(signedBuild({ ...signed, platform: 'linux', developerId: false })).toBe(false)
})
