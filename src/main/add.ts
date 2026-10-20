// Adding an app to a workspace: `prumo add` does all of it, and the Desktop only asks and shows the log.
import type { AddApp, AddResult } from '../shared/ipc.ts'
import { CliError, type CliOptions, runCli } from './cli.ts'
import type { Projects } from './projects.ts'

/**
 * Runs `prumo add <type> [name] --json` inside the project, as a plain child process like `prumo new`. The project
 * is read again afterwards, so the list shows the app the config now holds.
 */
export async function addApp(
  path: string,
  input: AddApp,
  projects: Projects,
  options: Omit<CliOptions, 'cwd'>,
): Promise<AddResult> {
  const args = ['add', input.type, ...(input.name === undefined ? [] : [input.name])]

  try {
    const { envelope } = await runCli(args, { ...options, cwd: path })

    if (!envelope.ok) {
      return { ok: false, code: envelope.error.code, message: envelope.error.message }
    }

    return { ok: true, project: projects.add(path) }
  } catch (problem) {
    if (problem instanceof CliError) {
      return { ok: false, code: problem.code, message: problem.message }
    }

    throw problem
  }
}
