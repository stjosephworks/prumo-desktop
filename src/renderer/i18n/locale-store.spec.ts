import { expect, test } from 'vitest'
import type { Bridge } from '../../shared/ipc.ts'
import type { Locale, LocaleState } from '../../shared/locales.ts'
import { followLocale } from './locale-store.ts'

/**
 * A bridge whose messages wait until released, as the main process's answers do while Windows reads the PATH. Each
 * message is delivered in a task of its own, in the order the main process sent it, as Electron delivers them: a
 * change is announced before the answer to the `set` that made it.
 */
function slowBridge(initial: LocaleState) {
  let state = initial
  let announce: ((state: LocaleState) => void) | undefined
  const messages: (() => void)[] = []
  const answer = <T>(compute: () => T, before?: (value: T) => void) =>
    new Promise<T>((done) => {
      messages.push(() => {
        const value = compute()
        if (before !== undefined) messages.unshift(() => done(value))
        before?.(value)
        if (before === undefined) done(value)
      })
    })

  const bridge: Bridge['locale'] = {
    get: () => answer(() => state),
    set: (locale: Locale | undefined) =>
      answer(
        () => {
          state = { locale: locale ?? initial.locale, chosen: locale !== undefined }
          return state
        },
        (value) => announce?.(value),
      ),
    onChange: (listener) => {
      announce = listener
      return () => {
        announce = undefined
      }
    },
  }

  /** Delivers every message, each in its own task, including those sent meanwhile. */
  const release = async () => {
    for (let message = messages.shift(); message; message = messages.shift()) {
      message()
      await new Promise((done) => setTimeout(done))
    }
  }

  return { bridge, release }
}

test('a change announced while the window starts is not lost', async () => {
  const { bridge, release } = slowBridge({ locale: 'en', chosen: false })
  const store = followLocale(bridge)

  // Another caller (the smoke check, or another window) switches before the first answer has arrived: the main
  // process answers the window's question with English, then announces Spanish.
  void bridge.set('es')
  await release()

  expect(store.current()).toEqual({ locale: 'es', chosen: true })
})

test('a change after the window has started reaches every subscriber', async () => {
  const { bridge, release } = slowBridge({ locale: 'pt', chosen: false })
  const store = followLocale(bridge)
  await release()
  expect(await store.ready).toEqual({ locale: 'pt', chosen: false })

  let heard = 0
  store.subscribe(() => heard++)
  store.choose('es')
  expect(store.current()).toEqual({ locale: 'es', chosen: true })
  await release()

  expect(store.current()).toEqual({ locale: 'es', chosen: true })
  expect(heard).toBeGreaterThan(0)
})

test('a choice the window kept before is handed over only when the main process has none', async () => {
  const none = slowBridge({ locale: 'en', chosen: false })
  const handed = followLocale(none.bridge, 'pt')
  await none.release()
  expect(await handed.ready).toEqual({ locale: 'pt', chosen: true })

  const some = slowBridge({ locale: 'es', chosen: true })
  const kept = followLocale(some.bridge, 'pt')
  await some.release()
  expect(await kept.ready).toEqual({ locale: 'es', chosen: true })
})
