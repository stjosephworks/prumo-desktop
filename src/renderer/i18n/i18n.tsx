import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { type Locale, localeTag } from '../../shared/locales.ts'
import { DICTIONARIES } from './dictionaries.ts'
import { type Dictionary, en } from './en.ts'

/** Where the renderer kept the language before the main process did (0.0.3 and earlier). */
const LEGACY_STORED = 'prumo.locale'

/**
 * The language the window opens in, which the main process owns (src/main/main.ts). A choice made before the main
 * process kept it lived in this window's storage; it is handed over once, so an update does not forget it.
 */
export async function initialLocale(): Promise<Locale> {
  const { locale, chosen } = await window.prumo.locale.get()

  try {
    const legacy = localStorage.getItem(LEGACY_STORED)
    localStorage.removeItem(LEGACY_STORED)
    if (!chosen && (legacy === 'en' || legacy === 'pt'))
      return await window.prumo.locale.set(legacy)
  } catch {
    // Storage can be unavailable; the main process still answers.
  }

  return locale
}

type I18n = { locale: Locale; t: Dictionary; setLocale: (locale: Locale) => void }

const Context = createContext<I18n>({ locale: 'en', t: en, setLocale: () => {} })

export function I18nProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initial)

  // A change made anywhere, this window included, arrives here once the main process has kept it.
  useEffect(() => window.prumo.locale.onChange(setLocale), [])

  // Screen readers and the browser's own text handling read the page's language from here.
  useEffect(() => {
    document.documentElement.lang = localeTag(locale)
  }, [locale])

  const choose = (next: Locale) => {
    setLocale(next)
    void window.prumo.locale.set(next)
  }

  return (
    <Context.Provider value={{ locale, t: DICTIONARIES[locale], setLocale: choose }}>
      {children}
    </Context.Provider>
  )
}

/** The words of the language in use. */
export function useT(): Dictionary {
  return useContext(Context).t
}

export function useLocale(): Pick<I18n, 'locale' | 'setLocale'> {
  const { locale, setLocale } = useContext(Context)
  return { locale, setLocale }
}
