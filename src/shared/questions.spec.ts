import { expect, test } from 'vitest'
import {
  allowsAlone,
  asksEmail,
  asksMcp,
  asksSocial,
  asksTenancy,
  defaultApps,
  newFlags,
} from './questions.ts'

test('tenancy is asked unless the project is only a site', () => {
  expect(asksTenancy(['site'])).toBe(false)
  expect(asksTenancy(['site', 'mobile'])).toBe(true)
  expect(asksTenancy(['api'])).toBe(true)
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

test('email is asked whenever there is an api', () => {
  expect(asksEmail(['api'])).toBe(true)
  expect(asksEmail(['web', 'mobile'])).toBe(false)
})

test('social sign-in is asked with an api and a web or mobile app', () => {
  expect(asksSocial(['api', 'web'])).toBe(true)
  expect(asksSocial(['api', 'mobile'])).toBe(true)
  expect(asksSocial(['api'])).toBe(false)
  expect(asksSocial(['api', 'site'])).toBe(false)
  expect(asksSocial(['web', 'mobile'])).toBe(false)
})

const answers = {
  architecture: 'monorepo' as const,
  multiTenant: false,
  mcp: false,
  email: false,
  social: [],
}

test('every question that applies gets exactly one flag', () => {
  expect(newFlags({ ...answers, apps: defaultApps(['api', 'web']) })).toEqual([
    '--types',
    'api,web',
    '--monorepo',
    '--single-tenant',
    '--no-mcp',
    '--no-email',
    '--no-social',
  ])
  expect(
    newFlags({
      ...answers,
      apps: defaultApps(['api', 'mobile']),
      email: true,
      social: ['apple', 'google'],
    }),
  ).toEqual([
    '--types',
    'api,mobile',
    '--monorepo',
    '--single-tenant',
    '--email',
    '--social',
    'google,apple',
  ])
})

test('a question that does not apply gets no flag, whatever the form held', () => {
  expect(
    newFlags({
      ...answers,
      apps: defaultApps(['site']),
      architecture: 'alone',
      multiTenant: true,
      mcp: true,
      email: true,
      social: ['google'],
    }),
  ).toEqual(['--types', 'site', '--alone'])
  expect(newFlags({ ...answers, apps: defaultApps(['api']), social: ['google'] })).toEqual([
    '--types',
    'api',
    '--monorepo',
    '--single-tenant',
    '--no-email',
  ])
})

test('an app named on purpose is an --app, after the types that keep their names', () => {
  expect(
    newFlags({
      ...answers,
      apps: [
        { name: 'server', type: 'api' },
        { name: 'web', type: 'web' },
        { name: 'backoffice', type: 'web' },
      ],
    }),
  ).toEqual([
    '--types',
    'web',
    '--app',
    'server=api',
    '--app',
    'backoffice=web',
    '--monorepo',
    '--single-tenant',
    '--no-mcp',
    '--no-email',
    '--no-social',
  ])
  expect(newFlags({ ...answers, apps: [{ name: 'admin', type: 'web' }] })).toEqual([
    '--app',
    'admin=web',
    '--monorepo',
    '--single-tenant',
  ])
})
