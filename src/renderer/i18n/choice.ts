// What the language select holds: a language the user chose, or the choice to follow the system. No React, so the
// tests can read it.
import { isLocale, type Locale, type LocaleState } from '../../shared/locales.ts'

/** The select's first option, which forgets the choice so the system's language answers again. */
export const FOLLOW_SYSTEM = 'system'

/** The option the select shows: following the system shows as that, never as the language it resolved to. */
export function choiceOf(state: LocaleState): string {
  return state.chosen ? state.locale : FOLLOW_SYSTEM
}

/** The language an option asks for; undefined for following the system, and for anything unknown. */
export function localeOf(choice: string): Locale | undefined {
  return isLocale(choice) ? choice : undefined
}
