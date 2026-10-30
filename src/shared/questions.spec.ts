import { expect, test } from 'vitest'
import type { ProjectLanguage, SignInMethod } from './ipc.ts'
import {
  allowsAlone,
  asksEmail,
  asksMcp,
  asksSignIn,
  asksSocial,
  asksTenancy,
  defaultApps,
  newFlags,
  typeFlag,
} from './questions.ts'

test('tenancy is asked of any project', () => {
  expect(asksTenancy(['web'])).toBe(true)
  expect(asksTenancy(['api'])).toBe(true)
  expect(asksTenancy([])).toBe(false)
})

test('a web app is passed with its framework, Vite when it names none', () => {
  expect(typeFlag({ type: 'web', framework: 'astro' })).toBe('web:astro')
  expect(typeFlag({ type: 'web' })).toBe('web:vite')
  expect(typeFlag({ type: 'api' })).toBe('api')
  expect(defaultApps(['api', 'web'], 'next')).toEqual([
    { name: 'api', type: 'api' },
    { name: 'web', type: 'web', framework: 'next' },
  ])
})

test('MCP is asked only with both api and web', () => {
  expect(asksMcp(['api', 'web'])).toBe(true)
  expect(asksMcp(['api', 'mobile'])).toBe(false)
  expect(asksMcp(['web'])).toBe(false)
})

test('alone is allowed for one app only, named after its type', () => {
  expect(allowsAlone(defaultApps(['web']))).toBe(true)
  expect(allowsAlone(defaultApps(['api', 'web']))).toBe(false)
  expect(allowsAlone([{ name: 'admin', type: 'web' }])).toBe(false)
})

test('sign-in is asked whenever there is an api, and email only with a password among its ways', () => {
  expect(asksSignIn(['api'])).toBe(true)
  expect(asksSignIn(['web', 'mobile'])).toBe(false)
  expect(asksEmail(['api'], ['password', 'email-code'])).toBe(true)
  expect(asksEmail(['api'], ['email-code', 'phone-code'])).toBe(false)
  expect(asksEmail(['web', 'mobile'], ['password'])).toBe(false)
})

test('social sign-in is asked with an api and a web or mobile app', () => {
  expect(asksSocial(['api', 'web'])).toBe(true)
  expect(asksSocial(['api', 'mobile'])).toBe(true)
  expect(asksSocial(['api'])).toBe(false)
  expect(asksSocial(['web', 'mobile'])).toBe(false)
})

const answers = {
  architecture: 'monorepo' as const,
  multiTenant: false,
  multiLanguage: false,
  languages: ['en'] as ProjectLanguage[],
  mcp: false,
  signIn: ['password'] as SignInMethod[],
  email: false,
  social: [],
}

test('every question that applies gets exactly one flag', () => {
  expect(newFlags({ ...answers, apps: defaultApps(['api', 'web']) })).toEqual([
    '--types',
    'api,web:vite',
    '--monorepo',
    '--single-tenant',
    '--single-language',
    '--languages',
    'en',
    '--no-mcp',
    '--sign-in',
    'password',
    '--no-email',
    '--no-social',
  ])
  expect(
    newFlags({
      ...answers,
      apps: defaultApps(['api', 'mobile']),
      signIn: ['phone-code', 'password'],
      email: true,
      social: ['apple', 'google'],
    }),
  ).toEqual([
    '--types',
    'api,mobile',
    '--monorepo',
    '--single-tenant',
    '--single-language',
    '--languages',
    'en',
    '--sign-in',
    'password,phone-code',
    '--email',
    '--social',
    'google,apple',
  ])
})

test('a question that does not apply gets no flag, whatever the form held', () => {
  expect(
    newFlags({
      ...answers,
      apps: defaultApps(['web'], 'next'),
      architecture: 'alone',
      multiTenant: true,
      multiLanguage: false,
      languages: ['en'],
      mcp: true,
      email: true,
      social: ['google'],
    }),
  ).toEqual([
    '--types',
    'web:next',
    '--alone',
    '--multi-tenant',
    '--single-language',
    '--languages',
    'en',
  ])
  expect(newFlags({ ...answers, apps: defaultApps(['api']), social: ['google'] })).toEqual([
    '--types',
    'api',
    '--monorepo',
    '--single-tenant',
    '--single-language',
    '--languages',
    'en',
    '--sign-in',
    'password',
    '--no-email',
  ])
})

test('without a password among the ways in, email is not asked, since the CLI refuses --email then', () => {
  expect(
    newFlags({
      ...answers,
      apps: defaultApps(['api', 'web']),
      signIn: ['email-code'],
      email: true,
    }),
  ).toEqual([
    '--types',
    'api,web:vite',
    '--monorepo',
    '--single-tenant',
    '--single-language',
    '--languages',
    'en',
    '--no-mcp',
    '--sign-in',
    'email-code',
    '--no-social',
  ])
})

test('an app named on purpose is an --app, after the types that keep their names', () => {
  expect(
    newFlags({
      ...answers,
      apps: [
        { name: 'server', type: 'api' },
        { name: 'web', type: 'web' },
        { name: 'backoffice', type: 'web', framework: 'astro' },
      ],
    }),
  ).toEqual([
    '--types',
    'web:vite',
    '--app',
    'server=api',
    '--app',
    'backoffice=web:astro',
    '--monorepo',
    '--single-tenant',
    '--single-language',
    '--languages',
    'en',
    '--no-mcp',
    '--sign-in',
    'password',
    '--no-email',
    '--no-social',
  ])
  expect(newFlags({ ...answers, apps: [{ name: 'admin', type: 'web' }] })).toEqual([
    '--app',
    'admin=web:vite',
    '--monorepo',
    '--single-tenant',
    '--single-language',
    '--languages',
    'en',
  ])
})

test('a project speaks one language, or several with its base first', () => {
  const flagsOf = (input: Partial<typeof answers>) =>
    newFlags({ ...answers, apps: defaultApps(['web']), architecture: 'alone', ...input })

  expect(flagsOf({ languages: ['pt-BR'] })).toContain('--single-language')
  expect(flagsOf({ languages: ['pt-BR'] }).join(' ')).toContain('--languages pt-BR')
  expect(flagsOf({ multiLanguage: true, languages: ['es-419', 'en'] }).join(' ')).toContain(
    '--multi-language --languages es-419,en',
  )
})
