import { createContext, type ReactNode, useContext, useEffect, useSyncExternalStore } from 'react'
import { type Locale, type LocaleState, localeTag } from '../../shared/locales.ts'
import { DICTIONARIES } from './dictionaries.ts'
import { type Dictionary, en } from './en.ts'
import { followLocale } from './locale-store.ts'

/** Where the renderer kept the language before the main process did (0.0.3 and earlier). */
const LEGACY_STORED = 'prumo.locale'

function legacyChoice(): Locale | undefined {
  try {
    const legacy = localStorage.getItem(LEGACY_STORED)
    localStorage.removeItem(LEGACY_STORED)
    return legacy === 'en' || legacy === 'pt' ? legacy : undefined
  } catch {
    // Storage can be unavailable; the main process still answers.
    return undefined
  }
}

/** Started with the module, before anything renders: see followLocale for why it listens first. */
const store = followLocale(window.prumo.locale, legacyChoice())

/** Settles once the main process has said which language the window opens in. */
export const localeReady: Promise<LocaleState> = store.ready

type I18n = LocaleState & {
  t: Dictionary
  /** A language to keep, or undefined to follow the system's again. */
  setLocale: (locale: Locale | undefined) => void
}

const Context = createContext<I18n>({ locale: 'en', chosen: false, t: en, setLocale: () => {} })

export function I18nProvider({ children }: { children: ReactNode }) {
  // Rendered only once `localeReady` has settled, so there is always a state here.
  const state = useSyncExternalStore(store.subscribe, store.current) ?? {
    locale: 'en' as const,
    chosen: false,
  }

  // Screen readers and the browser's own text handling read the page's language from here.
  useEffect(() => {
    document.documentElement.lang = localeTag(state.locale)
  }, [state.locale])

  return (
    <Context.Provider value={{ ...state, t: DICTIONARIES[state.locale], setLocale: store.choose }}>
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
