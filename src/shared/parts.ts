// What a project is made of, and the command that starts each part.
// The CLI lists a workspace's apps in .prumo/config.json; how a part is started and where it sits is the one piece
// of Prumo's layout the Desktop still has to know.
import type { App, AppType, Project, ProjectConfig } from './ipc.ts'

export type Part = App & {
  /** The pnpm script, which is what the process layer runs. */
  script: string
}

/** The apps a config describes; one written before 0.6.0 holds one per type, named after it. */
export function appsOf(config: ProjectConfig): App[] {
  return config.apps ?? config.types.map((type) => ({ name: type, type }))
}

/** The types of a set of apps, each once, in the order they first appear. */
export function typesOf(apps: App[]): AppType[] {
  return [...new Set(apps.map((app) => app.type))]
}

/**
 * An `alone` project is one app and answers to `pnpm dev`. A workspace has one script per app at its root,
 * named after the app (`pnpm api`, `pnpm backoffice`), which Prumo writes as `pnpm --filter <app> dev`.
 */
export function partsFor(project: Project): Part[] {
  const config = project.config

  if (config === undefined) return []

  return appsOf(config).map((app) => ({
    ...app,
    script: config.architecture === 'alone' ? 'dev' : app.name,
  }))
}

/** Where an app sits: the project itself when it is alone, `apps/<name>` in a workspace. */
export function appDirectory(project: Project, app: App): string {
  return project.config?.architecture === 'alone'
    ? project.path
    : `${project.path}/apps/${app.name}`
}

/**
 * Where the API sits, which is where its `docker-compose.yml`, its `.env` and its `db:migrate` script live.
 * Undefined when the project has no API.
 */
export function apiDirectory(project: Project): string | undefined {
  const api = partsFor(project).find((part) => part.type === 'api')

  return api === undefined ? undefined : appDirectory(project, api)
}

/** The id the process layer gives an app, so a screen can find its state without starting anything. */
export function partId(project: Project, part: Part): string {
  return `${project.path}#${part.script}`
}

/**
 * The last segment of a path, for the renderer, which has no `node:path`. Either separator counts: a path the main
 * process hands over on Windows is written with backslashes.
 */
export function folderName(path: string): string {
  return (
    path
      .split(/[\\/]/)
      .filter((segment) => segment !== '')
      .at(-1) ?? path
  )
}
