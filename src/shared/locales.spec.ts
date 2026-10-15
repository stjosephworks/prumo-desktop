import { describe, expect, test } from 'vitest'
import { isLocale, LOCALES, localeFor, resolveLocale, systemLocale } from './locales.ts'

describe('the system language', () => {
  test.each([
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['pt-BR', 'pt'],
    ['pt-PT', 'pt'],
    ['es', 'es'],
    ['es-MX', 'es'],
    ['es-419', 'es'],
    ['es-ES', 'es'],
    // Linux names languages after POSIX locales.
    ['es_MX.UTF-8', 'es'],
    ['pt_BR@euro', 'pt'],
    ['PT-br', 'pt'],
  ])('%s opens the app in %s', (language, locale) => {
    expect(systemLocale([language])).toBe(locale)
  })

  test.each([['fr'], ['fr-FR'], ['de-DE'], ['zh-Hans-CN'], ['C'], ['']])(
    '%s, which the app does not speak, opens it in English',
    (language) => {
      expect(localeFor(language)).toBeUndefined()
      expect(systemLocale([language])).toBe('en')
    },
  )

  test('the first preferred language the app speaks wins, in the order the system lists them', () => {
    expect(systemLocale(['fr-FR', 'pt-BR'])).toBe('pt')
    expect(systemLocale(['de-DE', 'fr-FR', 'es-MX', 'pt-BR'])).toBe('es')
    expect(systemLocale(['es-AR', 'pt-BR'])).toBe('es')
    // Linux lists every form of each language, ending in C.
    expect(systemLocale(['fr_FR.UTF-8', 'fr_FR', 'fr', 'C'])).toBe('en')
  })

  test("Chromium's locale answers when no preferred language is one the app speaks, then English", () => {
    expect(systemLocale([], 'pt-BR')).toBe('pt')
    expect(systemLocale(['fr-FR', 'de-DE'], 'es-419')).toBe('es')
    expect(systemLocale(['fr-FR'], 'fr')).toBe('en')
    expect(systemLocale([])).toBe('en')
  })

  test("the user's choice overrides the system's", () => {
    expect(resolveLocale('pt', ['es-MX'])).toBe('pt')
    expect(resolveLocale('en', ['pt-BR'], 'pt-BR')).toBe('en')
    expect(resolveLocale(undefined, ['es-MX'])).toBe('es')
  })
})

describe('the registry', () => {
  test('codes are unique, each names itself, and each matches its own base language', () => {
    const codes = LOCALES.map((one) => one.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const locale of LOCALES) {
      expect(isLocale(locale.code)).toBe(true)
      expect(locale.name.trim()).not.toBe('')
      expect(systemLocale([locale.tag])).toBe(locale.code)
    }
    expect(isLocale('fr')).toBe(false)
  })
})
