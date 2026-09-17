// Creating a project: the form's answers become flags, and the CLI decides everything else.
import { join } from 'node:path'
import type { CreateResult, NewProject } from '../shared/ipc.ts'
import { CliError, type CliOptions, runCli } from './cli.ts'
import type { Projects } from './projects.ts'

type Created = { name: string; target: string; installed: boolean }

/**
 * Runs `prumo new` with every flag and `--json`, as a plain child process: inside a pseudo terminal the CLI's
 * document on stdout and its log on stderr would arrive mixed together.
 * A project that was created is added to the list straight away, with no folder for the user to find again.
 */
export async function createProject(
  input: NewProject,
  projects: Projects,
  options: Omit<CliOptions, 'cwd'>,
): Promise<CreateResult> {
  const args = [
    'new',
    input.name,
    '--types',
    input.types.join(','),
    input.architecture === 'alone' ? '--alone' : '--monorepo',
    input.multiTenant ? '--multi-tenant' : '--single-tenant',
  ]

  try {
    const { envelope } = await runCli<Created>(args, { ...options, cwd: input.parent })

    if (!envelope.ok) {
      return { ok: false, code: envelope.error.code, message: envelope.error.message }
    }

    // `target` is the CLI's own answer for where the project landed; the join is only a fallback.
    return {
      ok: true,
      project: projects.add(envelope.data.target ?? join(input.parent, input.name)),
    }
  } catch (problem) {
    if (problem instanceof CliError) {
      return { ok: false, code: problem.code, message: problem.message }
    }

    throw problem
  }
}
