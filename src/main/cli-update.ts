// Which Prumo CLI the Desktop runs, and bringing it up to date. No Electron here, so the tests run in plain Node.
//
// The Desktop ships a CLI inside its bundle, which cannot change once signed. A newer one is installed beside
// the app's data instead, and used in its place, but only within the minor version the Desktop was built and
// tested with: 0.1.x for a Desktop that ships 0.1.0. A new minor may change the flags or the JSON the Desktop
// reads, as 0.1.0 did, so it arrives with a new Desktop, not through this.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CliStatus } from '../shared/ipc.ts'
import { compareVersions, parseVersion, sameMinor } from '../shared/versions.ts'
import { findNode, findOnPath, npmCommand } from './environment.ts'
import { endTree } from './processes.ts'

const PACKAGE = '@stjoseph/prumo'
// The abbreviated document npm itself installs from: every version and the dist-tags, without the readmes.
const REGISTRY = `https://registry.npmjs.org/${PACKAGE}`
const ABBREVIATED = 'application/vnd.npm.install-v1+json'

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
 * How long installing a CLI may take before it is stopped. On a Windows CI runner, with other installs writing
 * thousands of files at the same time, npm was measured spending up to 95 seconds just loading its own modules
 * (every file read waits on the antivirus) and up to 231 seconds in all; an idle machine takes seconds. Five minutes
 * leaves room for a slow machine and still ends a wait no one should sit through.
 */
export const INSTALL_DEADLINE_MS = 5 * 60_000

/** Asking the installed CLI for its version takes well under a second; this only ends one that hangs. */
const VERSION_DEADLINE_MS = 60_000

export class DeadlineError extends Error {}

/**
 * Runs a command to its end, or stops it with everything it started once `deadlineMs` has passed: nothing it runs
 * may keep the Desktop waiting forever. stdin is closed, so a command that asks a question gets no answer and ends
 * instead of waiting for one.
 */
function runWithin(
  command: string,
  args: string[],
  deadlineMs: number,
  what: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((done, fail) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let late = false

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const timer = setTimeout(() => {
      late = true
      if (child.pid !== undefined) endTree(child.pid)
    }, deadlineMs)

    child.on('error', (problem) => {
      clearTimeout(timer)
      fail(problem)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (late) {
        fail(
          new DeadlineError(
            `${what} took longer than ${Math.round(deadlineMs / 1000)} seconds and was stopped.`,
          ),
        )
      } else if (code === 0) {
        done({ stdout, stderr })
      } else {
        fail(new Error(`${what} failed (exit ${code}): ${stderr.trim().split('\n').at(-1) ?? ''}`))
      }
    })
  })
}

/**
 * Installs `version` into `updates`. It is installed into a fresh folder first and asked for its version, and
 * only then takes the place of the previous one, so a failed download never leaves the Desktop without a CLI.
 */
export async function installCli(
  version: string,
  updates: string,
  deadlineMs = INSTALL_DEADLINE_MS,
): Promise<void> {
  const node = await findNode()
  const npm = findOnPath('npm')

  if (node === undefined) throw new Error('Node was not found on this machine.')
  if (npm === undefined) throw new Error('npm was not found on this machine.')

  mkdirSync(dirname(updates), { recursive: true })
  const staging = mkdtempSync(`${updates}-next-`)
  const { command, args } = npmCommand(npm, node.path)

  try {
    await runWithin(
      command,
      [
        ...args,
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
      deadlineMs,
      `Installing Prumo ${version}`,
    )

    const { stdout } = await runWithin(
      node.path,
      [entryIn(staging), '--version'],
      VERSION_DEADLINE_MS,
      `Prumo ${version} --version`,
    )

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
