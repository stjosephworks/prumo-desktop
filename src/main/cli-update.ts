// Which Prumo CLI the Desktop runs, and bringing it up to date. No Electron here, so the tests run in plain Node.
//
// The Desktop ships a CLI inside its bundle, which cannot change once signed. A newer one is installed beside
// the app's data instead, and used in its place, but only within the minor version the Desktop was built and
// tested with: 0.1.x for a Desktop that ships 0.1.0. A new minor may change the flags or the JSON the Desktop
// reads, as 0.1.0 did, so it arrives with a new Desktop, not through this.
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { CliStatus } from '../shared/ipc.ts'
import { findNode, findOnPath } from './environment.ts'

const run = promisify(execFile)

const PACKAGE = '@stjoseph/prumo'
// The abbreviated document npm itself installs from: every version and the dist-tags, without the readmes.
const REGISTRY = `https://registry.npmjs.org/${PACKAGE}`
const ABBREVIATED = 'application/vnd.npm.install-v1+json'

type Version = [number, number, number]

/** A plain release, `x.y.z`. A prerelease is never offered as an update. */
export function parseVersion(text: string): Version | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text.trim())

  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(a: string, b: string): number {
  const [left, right] = [parseVersion(a), parseVersion(b)]

  if (left === undefined || right === undefined) return 0

  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
}

/** Whether the Desktop can run `candidate`, having been built with `shipped`: the same major and minor. */
export function sameMinor(shipped: string, candidate: string): boolean {
  const [left, right] = [parseVersion(shipped), parseVersion(candidate)]

  return left !== undefined && right !== undefined && left[0] === right[0] && left[1] === right[1]
}

/** Where a CLI installed by `npm install --prefix <folder>` keeps its entry point. */
function entryIn(folder: string): string {
  return join(folder, 'node_modules', ...PACKAGE.split('/'), 'dist', 'cli.js')
}

function versionAt(cli: string): string | undefined {
  try {
    const manifest = join(dirname(dirname(cli)), 'package.json')

    return (JSON.parse(readFileSync(manifest, 'utf8')) as { version?: string }).version
  } catch {
    return undefined
  }
}

export type ActiveCli = {
  path: string
  version: string
  shipped: string
  source: CliStatus['source']
}

/**
 * The CLI to run: the updated one when it is newer than the shipped one and within its minor, the shipped one
 * otherwise. A Desktop that later ships a newer CLI than the one it updated to simply goes back to its own.
 */
export function activeCli(shippedCli: string, updates: string): ActiveCli {
  const shipped = versionAt(shippedCli) ?? '0.0.0'
  const updatedCli = entryIn(updates)
  const updated = existsSync(updatedCli) ? versionAt(updatedCli) : undefined

  if (
    updated !== undefined &&
    sameMinor(shipped, updated) &&
    compareVersions(updated, shipped) > 0
  ) {
    return { path: updatedCli, version: updated, shipped, source: 'updated' }
  }

  return { path: shippedCli, version: shipped, shipped, source: 'shipped' }
}

/** Every version the registry holds, newest first, prereleases left out. */
export async function publishedVersions(): Promise<string[]> {
  const response = await fetch(REGISTRY, {
    headers: { accept: ABBREVIATED },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) throw new Error(`The npm registry answered ${response.status}.`)

  const document = (await response.json()) as { versions?: Record<string, unknown> }

  return Object.keys(document.versions ?? {})
    .filter((version) => parseVersion(version) !== undefined)
    .sort((a, b) => compareVersions(b, a))
}

/** What the screen shows: the CLI in use, and what the registry has that is newer. */
export function statusOf(active: ActiveCli, published: string[]): CliStatus {
  const newer = published.filter((version) => compareVersions(version, active.version) > 0)
  const available = newer.find((version) => sameMinor(active.shipped, version))
  const needsDesktop = newer.find((version) => !sameMinor(active.shipped, version))

  return { version: active.version, source: active.source, available, needsDesktop }
}

/**
 * Installs `version` into `updates`. It is installed into a fresh folder first and asked for its version, and
 * only then takes the place of the previous one, so a failed download never leaves the Desktop without a CLI.
 */
export async function installCli(version: string, updates: string): Promise<void> {
  const node = await findNode()
  const npm = findOnPath('npm')

  if (node === undefined) throw new Error('Node was not found on this machine.')
  if (npm === undefined) throw new Error('npm was not found on this machine.')

  mkdirSync(dirname(updates), { recursive: true })
  const staging = mkdtempSync(`${updates}-next-`)

  try {
    await run(
      npm,
      [
        'install',
        `${PACKAGE}@${version}`,
        '--prefix',
        staging,
        '--omit=dev',
        '--ignore-scripts',
        '--no-package-lock',
        '--no-audit',
        '--no-fund',
      ],
      { env: process.env },
    )

    const { stdout } = await run(node.path, [entryIn(staging), '--version'], { env: process.env })

    if (stdout.trim() !== version) {
      throw new Error(`The installed CLI says ${stdout.trim()}, not ${version}.`)
    }

    const previous = `${updates}-previous`
    rmSync(previous, { recursive: true, force: true })
    if (existsSync(updates)) renameSync(updates, previous)
    renameSync(staging, updates)
    rmSync(previous, { recursive: true, force: true })
  } catch (problem) {
    rmSync(staging, { recursive: true, force: true })
    throw problem
  }
}
