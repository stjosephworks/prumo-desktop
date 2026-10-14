// What the Desktop remembers about this machine, beside its project list. No Electron here.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type Stored = {
  /** The node executable the user picked, when no PATH and no usual folder had one. */
  node?: string
}

export class Settings {
  private readonly file: string

  constructor(file: string) {
    this.file = file
  }

  read(): Stored {
    try {
      const content = JSON.parse(readFileSync(this.file, 'utf8')) as Stored
      return typeof content.node === 'string' ? { node: content.node } : {}
    } catch {
      return {}
    }
  }

  write(change: Partial<Stored>): Stored {
    const next = { ...this.read(), ...change }
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`)
    return next
  }
}
