// Which of `prumo new`'s questions apply to a set of types. The form uses it to show only what the CLI will ask,
// and the main process to pass only the flags the CLI accepts. The rules are the CLI's (src/questions.ts in
// Prumo); a change there is a change here.
import type {
  App,
  AppType,
  ProjectConfig,
  ProjectLanguage,
  SignInMethod,
  SocialProvider,
  WebFramework,
} from './ipc.ts'
import { typesOf } from './parts.ts'

type Types = AppType[]

/** Only web may repeat in a workspace, on any framework; it holds one api and one mobile. */
export const REPEATABLE: AppType[] = ['web']

/** The frameworks a web app is built with, in the order the CLI offers them, Vite its default. */
export const WEB_FRAMEWORKS: WebFramework[] = ['vite', 'next', 'astro']

/** An app named after its type, which is what `--types` gives each type; a web app on the framework chosen. */
export function defaultApps(types: Types, framework: WebFramework = 'vite'): App[] {
  return types.map((type) =>
    type === 'web' ? { name: type, type, framework } : { name: type, type },
  )
}

/** A type as `--types`, `--app` and `prumo add` take it: `web:<framework>` for a web app, its type otherwise. */
export function typeFlag(app: { type: AppType; framework?: WebFramework }): string {
  return app.type === 'web' ? `web:${app.framework ?? 'vite'}` : app.type
}

/** The languages the CLI offers, in its order, each by its own name, which is how a speaker looks for it. */
export const PROJECT_LANGUAGES: { tag: ProjectLanguage; name: string }[] = [
  { tag: 'en', name: 'English' },
  { tag: 'pt-BR', name: 'Português (Brasil)' },
  { tag: 'es-419', name: 'Español (Latinoamérica)' },
]

/** The ways in the CLI offers, in its order; a password is its default. */
export const SIGN_IN_METHODS: SignInMethod[] = ['password', 'email-code', 'phone-code']

/** The providers the CLI offers, in its order. */
export const SOCIAL_PROVIDERS: SocialProvider[] = ['google', 'apple']

/** Tenancy shapes every type, so it is asked of any project. */
export function asksTenancy(types: Types): boolean {
  return types.length > 0
}

/** MCP authorizes through a sign-in page, which only a web app serves, so it needs both api and web. */
export function asksMcp(types: Types): boolean {
  return types.includes('api') && types.includes('web')
}

/** How people sign in is the API's to offer: the CLI refuses `--sign-in` without it. */
export function asksSignIn(types: Types): boolean {
  return types.includes('api')
}

/** Verification and password reset belong to a password account: the CLI refuses `--email` without one. */
export function asksEmail(types: Types, signIn: SignInMethod[]): boolean {
  return asksSignIn(types) && signIn.includes('password')
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
  multiLanguage: boolean
  languages: ProjectLanguage[]
  mcp: boolean
  signIn: SignInMethod[]
  email: boolean
  social: SocialProvider[]
}): string[] {
  const types = typesOf(input.apps)
  const defaults = input.apps.filter((app) => app.name === app.type)
  const flags = [
    ...(defaults.length > 0 ? ['--types', defaults.map(typeFlag).join(',')] : []),
    ...input.apps
      .filter((app) => app.name !== app.type)
      .flatMap((app) => ['--app', `${app.name}=${typeFlag(app)}`]),
    input.architecture === 'alone' ? '--alone' : '--monorepo',
  ]

  if (asksTenancy(types)) flags.push(input.multiTenant ? '--multi-tenant' : '--single-tenant')
  // Every project speaks at least one language, whatever its types; the base is first.
  flags.push(input.multiLanguage ? '--multi-language' : '--single-language')
  flags.push('--languages', input.languages.join(','))
  if (asksMcp(types)) flags.push(input.mcp ? '--mcp' : '--no-mcp')
  if (asksSignIn(types)) {
    const signIn = SIGN_IN_METHODS.filter((method) => input.signIn.includes(method))
    flags.push('--sign-in', signIn.join(','))
  }

  if (asksEmail(types, input.signIn)) flags.push(input.email ? '--email' : '--no-email')

  if (asksSocial(types)) {
    const social = SOCIAL_PROVIDERS.filter((provider) => input.social.includes(provider))
    flags.push(...(social.length > 0 ? ['--social', social.join(',')] : ['--no-social']))
  }

  return flags
}
