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

/** The id the process layer gives an app, so a screen can find its state without starting anything. */
export function partId(project: Project, part: Part): string {
  return `${project.path}#${part.script}`
}
