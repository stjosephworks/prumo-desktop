// Which of `prumo new`'s questions apply to a set of types. The form uses it to show only what the CLI will ask,
// and the main process to pass only the flags the CLI accepts. The rules are the CLI's (src/questions.ts in
// Prumo); a change there is a change here.
import type { ProjectConfig, SocialProvider } from './ipc.ts'

type Types = ProjectConfig['types']

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

/** Several types always make a workspace: the CLI refuses `--alone` with more than one. */
export function allowsAlone(types: Types): boolean {
  return types.length <= 1
}

/**
 * The flags of `prumo new` for the form's answers, beyond the name: exactly one per question the CLI asks for these
 * types, and none for a question it does not ask, which it would refuse or ignore. Without a terminal a question
 * left unanswered is `needs_input`, so every one that applies is answered.
 */
export function newFlags(input: {
  types: Types
  architecture: ProjectConfig['architecture']
  multiTenant: boolean
  mcp: boolean
  email: boolean
  social: SocialProvider[]
}): string[] {
  const { types } = input
  const flags = [
    '--types',
    types.join(','),
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
