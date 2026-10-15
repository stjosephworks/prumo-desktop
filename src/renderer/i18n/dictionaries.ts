// Every locale's words for the interface. Keyed by the registry in src/shared/locales.ts, so a locale added there
// does not build until it has a dictionary here. No React, so the parity test can read it.
import type { Locale } from '../../shared/locales.ts'
import { type Dictionary, en } from './en.ts'
import { es } from './es.ts'
import { pt } from './pt.ts'

export const DICTIONARIES: Record<Locale, Dictionary> = { en, pt, es }
