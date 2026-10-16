// The window's copy of the language, which the main process owns. No React, so the tests can drive it.
import type { Bridge } from '../../shared/ipc.ts'
import type { Locale, LocaleState } from '../../shared/locales.ts'

export type LocaleStore = {
  /** The language in use; undefined until the main process has first answered. */
  current: () => LocaleState | undefined
  subscribe: (listener: () => void) => () => void
  /** A language to keep, or undefined to follow the system's again. */
  choose: (locale: Locale | undefined) => void
  /** Settles once the main process has answered, with the language the window opens in. */
  ready: Promise<LocaleState>
}

/**
 * Listens before it asks. The main process can announce a change while the window is still starting, before any
 * component exists to hear it: on Windows every answer waits for the PATH read from the registry, seconds at times,
 * and a change made meanwhile used to be lost, leaving the window in the language it opened with.
 *
 * Every answer and every announcement arrives in the order the main process sent it, and each carries the whole
 * state, so the last to arrive is always the one in force.
 *
 * `legacy` is a choice kept by the window before the main process kept it (0.0.3 and earlier), handed over once
 * when the main process has none.
 */
export function followLocale(bridge: Bridge['locale'], legacy?: Locale): LocaleStore {
  let state: LocaleState | undefined
  const listeners = new Set<() => void>()

  const publish = (next: LocaleState) => {
    state = next
    for (const listener of listeners) listener()
  }

  bridge.onChange(publish)

  const ready = (async () => {
    const first = await bridge.get()
    publish(first)
    if (!first.chosen && legacy !== undefined) publish(await bridge.set(legacy))
    // A change announced after the first answer has already been published over it.
    return state ?? first
  })()

  return {
    current: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    choose: (locale) => {
      // A language shows at once; following the system waits for the main process to say which language that is.
      if (locale !== undefined) publish({ locale, chosen: true })
      void bridge.set(locale).then(publish)
    },
    ready,
  }
}
