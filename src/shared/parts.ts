// What a project is made of, and the command that starts each part.
// This is the one piece of Prumo's layout the Desktop has to know: the CLI exposes no list of parts.
import type { Project, ProjectConfig } from './ipc.ts'

export type Part = {
  type: ProjectConfig['types'][number]
  /** The pnpm script, which is what the process layer runs. */
  script: string
}

/**
 * An `alone` project is one app and answers to `pnpm dev`. A workspace has one script per app at its root,
 * named after the app (`pnpm api`), which Prumo writes as `pnpm --filter <app> dev`.
 */
export function partsFor(project: Project): Part[] {
  const config = project.config

  if (config === undefined) return []

  return config.types.map((type) => ({
    type,
    script: config.architecture === 'alone' ? 'dev' : type,
  }))
}

/**
 * Where the API sits, which is where its `docker-compose.yml`, its `.env` and its `db:migrate` script live:
 * the project itself when it is alone, `apps/api` in a workspace. Undefined when the project has no API.
 */
export function apiDirectory(project: Project): string | undefined {
  const config = project.config

  if (config === undefined || !config.types.includes('api')) return undefined

  return config.architecture === 'alone' ? project.path : `${project.path}/apps/api`
}

/** The id the process layer gives an app, so a screen can find its state without starting anything. */
export function partId(project: Project, part: Part): string {
  return `${project.path}#${part.script}`
}
