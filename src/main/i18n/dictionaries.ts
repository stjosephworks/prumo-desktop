// Every locale's words for the main process. Keyed by the registry in src/shared/locales.ts, so a locale added there
// does not build until it has a dictionary here. No Electron, so the parity test can read it.
import type { Locale } from '../../shared/locales.ts'
import { en, type MainDictionary } from './en.ts'
import { es } from './es.ts'
import { pt } from './pt.ts'

export const MAIN_DICTIONARIES: Record<Locale, MainDictionary> = { en, pt, es }
