// Finding the tools this machine has. No Electron here, so the tests run in plain Node.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { promisify } from 'node:util'
import fixPath from 'fix-path'

const run = promisify(execFile)

let fixed = false

/**
 * An app opened from Finder inherits launchd's `PATH`, not the shell's: measured in the spike as
 * `/usr/bin:/bin:/usr/sbin:/sbin`, where a Node installed by nvm, fnm or volta is invisible.
 * `fix-path` asks the user's own shell for its `PATH` and rewrites `process.env.PATH`.
 */
export function applyShellPath(): void {
  if (fixed) return
  fixPath()
  fixed = true
}

/** The first `command` on `PATH`, or undefined. Used for `node`, which nothing else can find for us. */
export function findOnPath(command: string): string | undefined {
  return (process.env.PATH ?? '')
    .split(delimiter)
    .filter((directory) => directory !== '')
    .map((directory) => join(directory, command))
    .find((candidate) => existsSync(candidate))
}

export type Node = { path: string; version: string }

/** The Node the Desktop will run the CLI and every project with, or undefined when there is none. */
export async function findNode(): Promise<Node | undefined> {
  applyShellPath()
  const path = findOnPath('node')

  if (path === undefined) return undefined

  try {
    const { stdout } = await run(path, ['--version'])
    return { path, version: stdout.trim().replace(/^v/, '') }
  } catch {
    return undefined
  }
}
