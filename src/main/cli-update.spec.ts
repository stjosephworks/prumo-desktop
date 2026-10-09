// The rules against made-up folders, and the registry and npm for real.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'
import {
  activeCli,
  compareVersions,
  installCli,
  publishedVersions,
  sameMinor,
  statusOf,
} from './cli-update.ts'

/** A CLI package as it sits on disk, with only what the rules read: its version. */
function fakeCli(folder: string, version: string): string {
  const cli = join(folder, 'dist', 'cli.js')
  mkdirSync(dirname(cli), { recursive: true })
  writeFileSync(cli, '')
  writeFileSync(join(folder, 'package.json'), JSON.stringify({ version }))
  return cli
}

function scene(shipped: string, updated?: string) {
  const root = mkdtempSync(join(tmpdir(), 'prumo-desktop-cli-'))
  const updates = join(root, 'updates')
  const cli = fakeCli(join(root, 'shipped'), shipped)
  if (updated !== undefined) fakeCli(join(updates, 'node_modules', '@stjoseph', 'prumo'), updated)
  return { cli, updates }
}

test('versions compare as numbers, and only a plain release counts', () => {
  expect(compareVersions('0.1.10', '0.1.9')).toBeGreaterThan(0)
  expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
  expect(sameMinor('0.1.0', '0.1.7')).toBe(true)
  expect(sameMinor('0.1.0', '0.2.0')).toBe(false)
  expect(sameMinor('0.1.0', '0.1.1-beta.1')).toBe(false)
})

test('a newer CLI of the same minor is used in place of the shipped one', () => {
  const { cli, updates } = scene('0.1.0', '0.1.2')

  expect(activeCli(cli, updates)).toMatchObject({
    version: '0.1.2',
    source: 'updated',
    shipped: '0.1.0',
  })
})

test('the shipped CLI wins over an updated one of another minor, or an older one', () => {
  for (const updated of ['0.2.0', '0.0.9', '0.1.0']) {
    const { cli, updates } = scene('0.1.0', updated)

    expect(activeCli(cli, updates)).toMatchObject({
      path: cli,
      version: '0.1.0',
      source: 'shipped',
    })
  }
})

test('the status offers the newest of the same minor, and names a newer minor apart', () => {
  const { cli, updates } = scene('0.1.0')
  const active = activeCli(cli, updates)

  expect(statusOf(active, ['0.2.0', '0.1.3', '0.1.1', '0.1.0'])).toEqual({
    version: '0.1.0',
    source: 'shipped',
    available: '0.1.3',
    needsDesktop: '0.2.0',
  })
  expect(statusOf(active, ['0.1.0', '0.0.6'])).toEqual({
    version: '0.1.0',
    source: 'shipped',
    available: undefined,
    needsDesktop: undefined,
  })
})

test('the registry lists the published versions, newest first', async () => {
  const versions = await publishedVersions()

  expect(versions).toContain('0.1.0')
  expect(compareVersions(versions[0] ?? '', versions.at(-1) ?? '')).toBeGreaterThanOrEqual(0)
})

test('installing puts a working CLI in place, and a failed one leaves the previous untouched', async () => {
  const root = mkdtempSync(join(tmpdir(), 'prumo-desktop-install-'))
  const updates = join(root, 'prumo')

  await installCli('0.1.0', updates)
  const cli = join(updates, 'node_modules', '@stjoseph', 'prumo', 'dist', 'cli.js')
  expect(existsSync(cli)).toBe(true)

  await expect(installCli('99.0.0', updates)).rejects.toThrow()
  expect(existsSync(cli)).toBe(true)
  // Neither the failed download nor the swap leaves a folder behind.
  expect(readdirSync(root)).toEqual(['prumo'])
}, 300_000)
