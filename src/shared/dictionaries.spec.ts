// Every locale in the registry, held to English's shape on both sides: a locale added to src/shared/locales.ts is
// covered here without touching this file.
import { describe, expect, test } from 'vitest'
import { MAIN_DICTIONARIES } from '../main/i18n/dictionaries.ts'
import { DICTIONARIES } from '../renderer/i18n/dictionaries.ts'
import { LOCALES } from './locales.ts'

/** Every leaf of a dictionary, as `path: kind`. */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'function') return [`${path}: function`]
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) =>
      shape(inner, path === '' ? key : `${path}.${key}`),
    )
  }
  return [`${path}: ${typeof value}`]
}

/** Every text a dictionary can produce, with each function called on sample arguments. */
function texts(value: unknown, path = ''): [string, unknown][] {
  if (typeof value === 'function') {
    const call = value as (...args: unknown[]) => unknown
    // Every function takes at most a few numbers or strings; a number reads as either in a template.
    return [[path, call(2, 2, 2)]]
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) =>
      texts(inner, path === '' ? key : `${path}.${key}`),
    )
  }
  return [[path, value]]
}

describe.each(LOCALES.map((one) => [one.code]))('%s', (code) => {
  for (const [side, dictionaries] of [
    ['the interface', DICTIONARIES],
    ['the main process', MAIN_DICTIONARIES],
  ] as const) {
    test(`${side} has every key English has, of the same kind, and nothing else`, () => {
      const dictionary = dictionaries[code as keyof typeof dictionaries]
      expect(dictionary).toBeDefined()
      expect(shape(dictionary)).toEqual(shape(dictionaries.en))
    })

    test(`${side} has no empty text`, () => {
      for (const [path, text] of texts(dictionaries[code as keyof typeof dictionaries])) {
        expect(typeof text, path).toBe('string')
        expect((text as string).trim(), path).not.toBe('')
      }
    })
  }
})
