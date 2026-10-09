// Before an app starts, its port. Every app Prumo generates carries `scripts/ports.mjs`, which answers in the
// same JSON envelope as the CLI; asked here, with `--check`, its question becomes buttons instead of a prompt
// waiting in a terminal. No Electron here, so the tests run in plain Node.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PortAnswer, PortCheck, Project, ProjectConfig } from '../shared/ipc.ts'
import { appDirectory } from '../shared/parts.ts'
import { CliError, runCli } from './cli.ts'

export async function checkPort(
  project: Project,
  type: ProjectConfig['types'][number],
  answer?: PortAnswer,
): Promise<PortCheck> {
  const directory = appDirectory(project, type)
  const script = join(directory, 'scripts', 'ports.mjs')

  // A project from a CLI older than 0.0.6 has no such script, and its dev server settles the port itself.
  if (!existsSync(script)) return { ok: true }

  const args = ['--check', ...(answer === undefined ? [] : [`--${answer}`])]

  try {
    const { envelope } = await runCli(args, { cli: script, cwd: directory })

    return envelope.ok ? { ok: true } : { ok: false, ...envelope.error }
  } catch (problem) {
    if (problem instanceof CliError)
      return { ok: false, code: problem.code, message: problem.message }

    throw problem
  }
}
