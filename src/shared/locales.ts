// Every language the Desktop speaks, in one place. A language added here breaks the build until both dictionaries
// have it (src/renderer/i18n/dictionaries.ts, src/main/i18n/dictionaries.ts), and the parity test covers it from then
// on without being touched.

export const LOCALES = [
  /** `tag` is the BCP 47 tag the words are written in; `base` the system languages it answers for. */
  { code: 'en', name: 'English', tag: 'en', base: ['en'] },
  { code: 'pt', name: 'Português', tag: 'pt-BR', base: ['pt'] },
] as const satisfies readonly {
  code: string
  /** The language's own name for itself, which is how the switch lists it. */
  name: string
  tag: string
  base: readonly string[]
}[]

export type Locale = (typeof LOCALES)[number]['code']

/** What a system language no locale answers for falls back to. */
export const FALLBACK_LOCALE: Locale = 'en'

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((one) => one.code === value)
}

/**
 * The locale a system language asks for, by its base language: `pt-BR` and `pt-PT` are
 * Portuguese. Linux names languages as `pt_BR.UTF-8` or `pt_BR@euro`, which read the same way. Anything else is
 * undefined.
 */
export function localeFor(language: string): Locale | undefined {
  const base = language
    .trim()
    .toLowerCase()
    .split(/[-_.@]/)[0]
  return LOCALES.find((one) => (one.base as readonly string[]).includes(base ?? ''))?.code
}

/**
 * The language the Desktop opens in before the user has chosen one: the system's own, which is the first of its
 * preferred languages, or `fallback` (Chromium's application locale) when the system lists none. A language the
 * Desktop does not speak opens it in English; the second language on the list is not consulted.
 */
export function systemLocale(preferred: readonly string[], fallback = ''): Locale {
  const first = preferred.find((one) => one.trim() !== '') ?? fallback
  return localeFor(first) ?? FALLBACK_LOCALE
}

/** The locale in use: the user's choice once there is one, the system's until then. */
export function resolveLocale(
  chosen: Locale | undefined,
  preferred: readonly string[],
  fallback = '',
): Locale {
  return chosen ?? systemLocale(preferred, fallback)
}

export function localeTag(locale: Locale): string {
  return LOCALES.find((one) => one.code === locale)?.tag ?? locale
}
