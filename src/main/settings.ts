// What the Desktop remembers about this machine, beside its project list. No Electron here.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { isLocale, type Locale } from '../shared/locales.ts'

export type Stored = {
  /** The node executable the user picked, when no PATH and no usual folder had one. */
  node?: string
  /** The language the user picked. Until there is one the Desktop follows the system's (src/shared/locales.ts). */
  locale?: Locale
}

export class Settings {
  private readonly file: string

  constructor(file: string) {
    this.file = file
  }

  /** Only what is valid is read back: a hand-edited or older file never hands out a value the app cannot use. */
  read(): Stored {
    try {
      const content = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, unknown>
      return {
        ...(typeof content.node === 'string' ? { node: content.node } : {}),
        ...(isLocale(content.locale) ? { locale: content.locale } : {}),
      }
    } catch {
      return {}
    }
  }

  /** A key given as undefined is forgotten. */
  write(change: Partial<Stored>): Stored {
    const next = { ...this.read(), ...change }
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`)
    return JSON.parse(JSON.stringify(next)) as Stored
  }
}
