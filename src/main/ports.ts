// Before an app starts, its port. Every app Prumo generates carries `scripts/ports.mjs`, which answers in the
// same JSON envelope as the CLI; asked here, with `--check`, its question becomes buttons instead of a prompt
// waiting in a terminal. No Electron here, so the tests run in plain Node.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PortAnswer, PortCheck, Project } from '../shared/ipc.ts'
import { appDirectory, partsFor } from '../shared/parts.ts'
import { CliError, runCli } from './cli.ts'

/** `name` is the app's: the script keys its answer by it, and before 0.6.0 every name was its type. */
export async function checkPort(
  project: Project,
  name: string,
  answer?: PortAnswer,
): Promise<PortCheck> {
  const app = partsFor(project).find((part) => part.name === name)

  if (app === undefined)
    return { ok: false, code: 'unknown_app', message: `No app is named ${name}.` }

  const directory = appDirectory(project, app)
  const script = join(directory, 'scripts', 'ports.mjs')

  // A project from a CLI older than 0.0.6 has no such script, and its dev server settles the port itself.
  if (!existsSync(script)) return { ok: true }

  const args = ['--check', ...(answer === undefined ? [] : [`--${answer}`])]

  try {
    const { envelope } = await runCli<{ ports?: Record<string, number> }>(args, {
      cli: script,
      cwd: directory,
    })

    // The port the app will start on, as the script settled it: where the Desktop then asks for its health.
    return envelope.ok
      ? { ok: true, port: envelope.data.ports?.[name] }
      : { ok: false, ...envelope.error }
  } catch (problem) {
    if (problem instanceof CliError)
      return { ok: false, code: problem.code, message: problem.message }

    throw problem
  }
}
