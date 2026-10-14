// The choice of release against made-up lists, and GitHub's own list for real.
import { expect, test } from 'vitest'
import { listReleases, newestRelease, type Release } from './app-update.ts'

const release = (tag: string, flags: Partial<Release> = {}): Release => ({
  tag_name: tag,
  html_url: `https://github.com/stjosephworks/prumo-desktop/releases/tag/${tag}`,
  draft: false,
  prerelease: false,
  ...flags,
})

test('offers the newest release above this one, compared as numbers', () => {
  const releases = [release('v0.0.9'), release('v0.0.10'), release('v0.0.2')]

  expect(newestRelease(releases, '0.0.2', false)).toEqual({
    version: '0.0.10',
    url: 'https://github.com/stjosephworks/prumo-desktop/releases/tag/v0.0.10',
  })
})

test('offers nothing when this one is the newest, or newer still', () => {
  expect(newestRelease([release('v0.0.2'), release('v0.0.1')], '0.0.2', true)).toBeUndefined()
  expect(newestRelease([release('v0.0.2')], '0.1.0', true)).toBeUndefined()
})

test('a pre-release counts only for a build that asks for them, and a draft never does', () => {
  const releases = [release('v0.0.4', { draft: true }), release('v0.0.3', { prerelease: true })]

  expect(newestRelease(releases, '0.0.2', false)).toBeUndefined()
  expect(newestRelease(releases, '0.0.2', true)?.version).toBe('0.0.3')
})

test('a tag that is not a plain version is ignored', () => {
  expect(newestRelease([release('nightly'), release('v1.0.0-beta.1')], '0.0.2', true)).toBe(
    undefined,
  )
})

// GitHub's unauthenticated limit is per address, which CI runners share; CI passes its own token.
test('GitHub lists this repository releases, the published pre-releases included', async () => {
  const releases = await listReleases(process.env.GITHUB_TOKEN || undefined)

  expect(releases.map((one) => one.tag_name)).toContain('v0.0.2')
  expect(newestRelease(releases, '0.0.1', true)).toBeDefined()
})
