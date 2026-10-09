// Which of `prumo new`'s questions apply to a set of types. The form uses it to show only what the CLI will ask,
// and the main process to pass only the flags the CLI accepts. The rules are the CLI's (src/questions.ts in
// Prumo); a change there is a change here.
import type { ProjectConfig } from './ipc.ts'

type Types = ProjectConfig['types']

/** Tenancy shapes api, web and mobile; a project that is only a site is never asked. */
export function asksTenancy(types: Types): boolean {
  return types.some((type) => type === 'api' || type === 'web' || type === 'mobile')
}

/** MCP authorizes through a sign-in page, which only a web app serves, so it needs both api and web. */
export function asksMcp(types: Types): boolean {
  return types.includes('api') && types.includes('web')
}

/** Several types always make a workspace: the CLI refuses `--alone` with more than one. */
export function allowsAlone(types: Types): boolean {
  return types.length <= 1
}
