// The database part: what `prumo db` says about it, and what Docker says about the container behind it.
// No Electron here, so the tests run in plain Node.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import type { DatabaseState, DockerState, Project } from '../shared/ipc.ts'
import { apiDirectory } from '../shared/parts.ts'
import { type CliOptions, runCli } from './cli.ts'

const run = promisify(execFile)

/**
 * Whether the API still has `DATABASE_URL=MISSING`. The answer comes from `prumo db --check`, which reads the
 * project's own `.env`, so the Desktop never parses that file itself.
 */
export async function databaseState(
  project: Project,
  options: Omit<CliOptions, 'cwd'>,
): Promise<DatabaseState> {
  const api = apiDirectory(project)

  if (api === undefined) return { part: false }

  const { envelope } = await runCli(['db', '--check'], { ...options, cwd: project.path })

  if (envelope.ok) return { part: true, created: true }

  return envelope.error.code === 'database_missing'
    ? { part: true, created: false }
    : { part: true, created: false, error: envelope.error }
}

/** Creates the development database in Docker and migrates it: `prumo db` asks for nothing but a name. */
export async function createDatabase(
  project: Project,
  name: string,
  options: Omit<CliOptions, 'cwd'>,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const { envelope } = await runCli(['db', '--name', name], { ...options, cwd: project.path })

  return envelope.ok ? { ok: true } : { ok: false, ...envelope.error }
}

async function docker(args: string[], cwd?: string): Promise<{ ok: boolean; stdout: string }> {
  try {
    const { stdout } = await run('docker', args, { cwd, env: process.env })

    return { ok: true, stdout }
  } catch {
    return { ok: false, stdout: '' }
  }
}

/**
 * The container's state, straight from Docker, so a container started in a terminal is recognised, and one left
 * running when the Desktop quits is found again on the next launch.
 */
export async function dockerState(project: Project): Promise<DockerState> {
  const api = apiDirectory(project)

  if (api === undefined || !existsSync(`${api}/docker-compose.yml`)) return { part: false }
  if (!(await docker(['--version'])).ok) return { part: true, docker: 'missing', services: [] }
  if (!(await docker(['info'])).ok) return { part: true, docker: 'stopped', services: [] }

  const { stdout } = await docker(['compose', 'ps', '--all', '--format', 'json'], api)
  // Compose prints one JSON object per line, and nothing at all when it has no services.
  const services = stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap((line) => {
      try {
        const service = JSON.parse(line) as { Service?: string; State?: string }

        return [{ name: service.Service ?? '?', state: service.State ?? 'unknown' }]
      } catch {
        return []
      }
    })

  return { part: true, docker: 'running', services }
}

export async function startDocker(project: Project): Promise<boolean> {
  const api = apiDirectory(project)

  return api === undefined ? false : (await docker(['compose', 'up', '-d', '--wait'], api)).ok
}

export async function stopDocker(project: Project): Promise<boolean> {
  const api = apiDirectory(project)

  return api === undefined ? false : (await docker(['compose', 'stop'], api)).ok
}
