import { createContext, type ReactNode, useContext, useState } from 'react'
import { type Dictionary, en } from './en.ts'
import { pt } from './pt.ts'

export type Locale = 'en' | 'pt'

const DICTIONARIES: Record<Locale, Dictionary> = { en, pt }
const STORED = 'prumo.locale'

/** The language chosen before, or the system's: Portuguese on a Mac set to Portuguese, English otherwise. */
function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORED)
    if (stored === 'en' || stored === 'pt') return stored
  } catch {
    // Storage can be unavailable; the system's language still answers.
  }
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

type I18n = { locale: Locale; t: Dictionary; setLocale: (locale: Locale) => void }

const Context = createContext<I18n>({ locale: 'en', t: en, setLocale: () => {} })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale)

  const choose = (next: Locale) => {
    setLocale(next)
    try {
      localStorage.setItem(STORED, next)
    } catch {
      // Remembered for this session only.
    }
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
