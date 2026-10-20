// Which of `prumo new`'s questions apply to a set of types. The form uses it to show only what the CLI will ask,
// and the main process to pass only the flags the CLI accepts. The rules are the CLI's (src/questions.ts in
// Prumo); a change there is a change here.
import type { App, AppType, ProjectConfig, SocialProvider } from './ipc.ts'
import { typesOf } from './parts.ts'

type Types = AppType[]

/** Only web and site may repeat in a workspace; it holds one api and one mobile. */
export const REPEATABLE: AppType[] = ['web', 'site']

/** An app named after its type, which is what `--types` gives each type. */
export function defaultApps(types: Types): App[] {
  return types.map((type) => ({ name: type, type }))
}

/** The providers the CLI offers, in its order. */
export const SOCIAL_PROVIDERS: SocialProvider[] = ['google', 'apple']

/** Tenancy shapes api, web and mobile; a project that is only a site is never asked. */
export function asksTenancy(types: Types): boolean {
  return types.some((type) => type === 'api' || type === 'web' || type === 'mobile')
}

/** MCP authorizes through a sign-in page, which only a web app serves, so it needs both api and web. */
export function asksMcp(types: Types): boolean {
  return types.includes('api') && types.includes('web')
}

/** Verification and password reset belong to the API: the CLI refuses `--email` without it. */
export function asksEmail(types: Types): boolean {
  return types.includes('api')
}

/** A provider sends the user back to a screen, so social sign-in needs the API and a web or mobile app. */
export function asksSocial(types: Types): boolean {
  return types.includes('api') && (types.includes('web') || types.includes('mobile'))
}

/** Several apps always make a workspace: the CLI refuses `--alone` with more than one, or with a named one. */
export function allowsAlone(apps: App[]): boolean {
  return apps.length <= 1 && apps.every((app) => app.name === app.type)
}

/**
 * The flags of `prumo new` for the form's answers, beyond the name: exactly one per question the CLI asks for these
 * types, and none for a question it does not ask, which it would refuse or ignore. Without a terminal a question
 * left unanswered is `needs_input`, so every one that applies is answered.
 */
export function newFlags(input: {
  apps: App[]
  architecture: ProjectConfig['architecture']
  multiTenant: boolean
  mcp: boolean
  email: boolean
  social: SocialProvider[]
}): string[] {
  const types = typesOf(input.apps)
  const defaults = input.apps.filter((app) => app.name === app.type)
  const flags = [
    ...(defaults.length > 0 ? ['--types', defaults.map((app) => app.type).join(',')] : []),
    ...input.apps
      .filter((app) => app.name !== app.type)
      .flatMap((app) => ['--app', `${app.name}=${app.type}`]),
    input.architecture === 'alone' ? '--alone' : '--monorepo',
  ]

  if (asksTenancy(types)) flags.push(input.multiTenant ? '--multi-tenant' : '--single-tenant')
  if (asksMcp(types)) flags.push(input.mcp ? '--mcp' : '--no-mcp')
  if (asksEmail(types)) flags.push(input.email ? '--email' : '--no-email')

  if (asksSocial(types)) {
    const social = SOCIAL_PROVIDERS.filter((provider) => input.social.includes(provider))
    flags.push(...(social.length > 0 ? ['--social', social.join(',')] : ['--no-social']))
  }

  return flags
}
