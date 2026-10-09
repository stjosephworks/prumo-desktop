// A project's Git state, read with git itself in the project's folder. Git is the project's, not Prumo's, so the
// CLI is not the one to ask. No Electron here.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitState } from '../shared/ipc.ts'

const run = promisify(execFile)

/** The branch and how many paths have changes, or undefined for a folder that is not a repository. */
export async function gitState(path: string): Promise<GitState | undefined> {
  try {
    const git = (args: string[]) =>
      run('git', ['-C', path, ...args], { env: process.env, timeout: 5_000 }).then(
        ({ stdout }) => stdout,
      )

    // --porcelain=v2 --branch gives the branch and every changed path in one stable, documented format.
    const output = await git(['status', '--porcelain=v2', '--branch'])
    const lines = output.split('\n').filter((line) => line !== '')
    const head = lines
      .find((line) => line.startsWith('# branch.head '))
      ?.slice('# branch.head '.length)
    const changes = lines.filter((line) => !line.startsWith('#')).length

    return { branch: head === '(detached)' || head === undefined ? undefined : head, changes }
  } catch {
    return undefined
  }
}
