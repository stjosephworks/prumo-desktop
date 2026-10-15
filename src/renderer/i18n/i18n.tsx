import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { type Locale, type LocaleState, localeTag } from '../../shared/locales.ts'
import { DICTIONARIES } from './dictionaries.ts'
import { type Dictionary, en } from './en.ts'

/** Where the renderer kept the language before the main process did (0.0.3 and earlier). */
const LEGACY_STORED = 'prumo.locale'

/**
 * The language the window opens in, which the main process owns (src/main/main.ts). A choice made before the main
 * process kept it lived in this window's storage; it is handed over once, so an update does not forget it.
 */
export async function initialLocale(): Promise<LocaleState> {
  const state = await window.prumo.locale.get()

  try {
    const legacy = localStorage.getItem(LEGACY_STORED)
    localStorage.removeItem(LEGACY_STORED)
    if (!state.chosen && (legacy === 'en' || legacy === 'pt'))
      return await window.prumo.locale.set(legacy)
  } catch {
    // Storage can be unavailable; the main process still answers.
  }

  return state
}

type I18n = LocaleState & {
  t: Dictionary
  /** A language to keep, or undefined to follow the system's again. */
  setLocale: (locale: Locale | undefined) => void
}

const Context = createContext<I18n>({ locale: 'en', chosen: false, t: en, setLocale: () => {} })

export function I18nProvider({ initial, children }: { initial: LocaleState; children: ReactNode }) {
  const [state, setState] = useState<LocaleState>(initial)

  // A change made anywhere, this window included, arrives here once the main process has kept it.
  useEffect(() => window.prumo.locale.onChange(setState), [])

  // Screen readers and the browser's own text handling read the page's language from here.
  useEffect(() => {
    document.documentElement.lang = localeTag(state.locale)
  }, [state.locale])

  const choose = (next: Locale | undefined) => {
    // A language shows at once; following the system waits for the main process to say which language that is.
    if (next !== undefined) setState({ locale: next, chosen: true })
    void window.prumo.locale.set(next).then(setState)
  }

  return (
    <Context.Provider value={{ ...state, t: DICTIONARIES[state.locale], setLocale: choose }}>
      {children}
    </Context.Provider>
  )
}

/** The words of the language in use. */
export function useT(): Dictionary {
  return useContext(Context).t
}

export function useLocale(): Omit<I18n, 't'> {
  const { locale, chosen, setLocale } = useContext(Context)
  return { locale, chosen, setLocale }
}
