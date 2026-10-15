// The language the Desktop speaks: the user's choice from settings.json, or the system's while there is none. No
// Electron here; the system's languages are handed in.
import { type Locale, type LocaleState, resolveLocale } from '../shared/locales.ts'
import type { Settings } from './settings.ts'

/** The system's preferred languages, in order, and Chromium's locale for when none of them is spoken. */
export type SystemLanguages = () => { preferred: readonly string[]; fallback: string }

export class Language {
  private readonly settings: Settings
  private readonly system: SystemLanguages

  constructor(settings: Settings, system: SystemLanguages) {
    this.settings = settings
    this.system = system
  }

  state(): LocaleState {
    const chosen = this.settings.read().locale
    const { preferred, fallback } = this.system()
    return { locale: resolveLocale(chosen, preferred, fallback), chosen: chosen !== undefined }
  }

  /** Keeps a language, or, given undefined, forgets the choice so the system's language answers again. */
  choose(locale: Locale | undefined): LocaleState {
    this.settings.write({ locale })
    return this.state()
  }
}
