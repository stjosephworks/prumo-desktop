// Finding the tools this machine has. No Electron here, so the tests run in plain Node.
import { execFile } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { promisify } from 'node:util'
import fixPath from 'fix-path'
import {
  gitLocations,
  loginEnvironment,
  nodeLocations,
  pnpmLocations,
  type RegistryEnvironment,
  readRegistryEnvironment,
} from './windows-path.ts'

const run = promisify(execFile)

let settled: Promise<void> | undefined

/**
 * An app opened from Finder inherits launchd's `PATH`, not the shell's: measured in the spike as
 * `/usr/bin:/bin:/usr/sbin:/sbin`, where a Node installed by nvm, fnm or volta is invisible.
 * `fix-path` asks the user's own shell for its `PATH` and rewrites `process.env.PATH`; on Linux the same.
 * On Windows fix-path does nothing, and the PATH comes from the registry and the usual install folders instead
 * (src/main/windows-path.ts), read in the background: PowerShell can take seconds to start.
 *
 * Started once; every later call waits for the same PATH. Anything that runs a command waits for it first.
 */
export function applyShellPath(): Promise<void> {
  settled ??=
    process.platform === 'win32'
      ? applyWindowsPath()
      : (() => {
          fixPath()
          return Promise.resolve()
        })()
  return settled
}

/** Folders that exist, added at the end of PATH: found only where nothing earlier answers. */
function appendToPath(folders: string[]): void {
  const extra = folders.filter((folder) => existsSync(folder))
  if (extra.length > 0) process.env.PATH = [process.env.PATH ?? '', ...extra].join(delimiter)
}

/** Why the PATH could not be read from the registry, for the This machine screen; undefined when it was. */
let registryProblem: string | undefined

export function pathProblem(): string | undefined {
  return registryProblem
}

/**
 * The registry's environment over the inherited one, then the usual install folders for whichever of Node, pnpm and
 * git is still missing. A registry that cannot be read, twice, leaves the inherited environment as it was, and the
 * reason is kept for the screen.
 */
export async function applyWindowsPath(
  read: () => Promise<RegistryEnvironment> | RegistryEnvironment = readRegistryEnvironment,
): Promise<void> {
  try {
    Object.assign(process.env, loginEnvironment(await read(), process.env))
    registryProblem = undefined
  } catch (problem) {
    // The inherited PATH and the folders below are what is left. Said in the log and kept for the screen, since a
    // Node found only through a folder hides that the registry was never read.
    registryProblem = (problem as Error).message
    console.warn(registryProblem)
  }

  if (findOnPath('node') === undefined) appendToPath(nodeLocations(process.env))
  if (findOnPath('pnpm') === undefined) appendToPath(pnpmLocations(process.env))
  if (findOnPath('git') === undefined) appendToPath(gitLocations(process.env))
}

/**
 * The executable names `command` may have on this system. Windows finds a command through `PATHEXT`
 * (`node.exe`, `npm.cmd`), and a bare name beside them, such as the shell script npm installs next to
 * `pnpm.cmd`, is not something Windows can run. Elsewhere the name is the file.
 */
export function executableNames(
  command: string,
  platform: NodeJS.Platform = process.platform,
  pathext = process.env.PATHEXT,
): string[] {
  if (platform !== 'win32') return [command]

  const listed = (pathext ?? '')
    .split(';')
    .map((extension) => extension.trim().toLowerCase())
    .filter((extension) => extension !== '')
  // An empty or missing PATHEXT means Windows' own default.
  const extensions = listed.length > 0 ? listed : ['.com', '.exe', '.bat', '.cmd']

  // A name that already carries one of the extensions is looked up as it is.
  if (extensions.some((extension) => command.toLowerCase().endsWith(extension))) return [command]

  return extensions.map((extension) => `${command}${extension}`)
}

/** The first `command` on `PATH`, or undefined. Used for `node`, which nothing else can find for us. */
export function findOnPath(command: string): string | undefined {
  const names = executableNames(command)

  return (process.env.PATH ?? '')
    .split(delimiter)
    .filter((directory) => directory !== '')
    .flatMap((directory) => names.map((name) => join(directory, name)))
    .find((candidate) => existsSync(candidate))
}

/**
 * How to run the `npm` found at `npm` with `node`. Node refuses to start a `.cmd` without a shell (EINVAL, since
 * the fix for CVE-2024-27980), and through a shell the arguments go unescaped, so npm's own entry point is run with
 * Node instead, wherever it can be found: on macOS and Linux `npm` is a link to `npm-cli.js`, and on Windows
 * `npm.cmd` runs the `node_modules/npm/bin/npm-cli.js` beside it, as the shim npm ships says. Anything else, such as
 * an `.exe` shim, is run as it is.
 */
export function npmCommand(npm: string, node: string): { command: string; args: string[] } {
  const real = realpathSync(npm)

  if (real.endsWith('.js')) return { command: node, args: [real] }

  const beside = join(dirname(npm), 'node_modules', 'npm', 'bin', 'npm-cli.js')

  if (existsSync(beside)) return { command: node, args: [beside] }

  return { command: npm, args: [] }
}

export type Node = { path: string; version: string }

/** The Node at `path`, asked for its version, or undefined when it does not run. */
export async function nodeAt(path: string): Promise<Node | undefined> {
  try {
    const { stdout } = await run(path, ['--version'], { timeout: 10_000 })
    const version = stdout.trim().replace(/^v/, '')
    return /^\d+\.\d+\.\d+/.test(version) ? { path, version } : undefined
  } catch {
    return undefined
  }
}

/** The node executable the user picked by hand, when no PATH has one (src/main/settings.ts keeps it). */
let chosen: string | undefined

/**
 * Uses `path` as Node, or forgets the choice with undefined. Its folder goes first on PATH, so the CLI, pnpm and
 * every project find the same Node as the Desktop.
 */
export function chooseNode(path: string | undefined): void {
  chosen = path
  if (path === undefined || !existsSync(path)) return

  const folder = dirname(path)
  const entries = (process.env.PATH ?? '').split(delimiter)
  if (!entries.includes(folder)) process.env.PATH = [folder, ...entries].join(delimiter)
}

/** The Node the Desktop will run the CLI and every project with, or undefined when there is none. */
export async function findNode(): Promise<Node | undefined> {
  await applyShellPath()

  if (chosen !== undefined && existsSync(chosen)) {
    const node = await nodeAt(chosen)
    if (node !== undefined) return node
  }

  const path = findOnPath('node')

  return path === undefined ? undefined : nodeAt(path)
}
