// Against this machine's real apps on macOS; on Linux, against stand-ins put on PATH, since a CI runner has no
// editor or terminal of its own. Nothing real is opened.
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { openers, openIn } from './open-in.ts'

const mac = process.platform === 'darwin'
const linux = process.platform === 'linux'

/** A command on PATH that writes where it was started and what it was given, then exits. */
function standIn(bin: string, name: string, out: string): void {
  const script = join(bin, name)
  writeFileSync(script, `#!/bin/sh\nprintf '%s\\n' "$PWD" "$@" > '${out}'\n`)
  chmodSync(script, 0o755)
}

async function readWhenWritten(path: string): Promise<string[]> {
  for (let attempt = 0; attempt < 50 && !existsSync(path); attempt++) {
    await new Promise((done) => setTimeout(done, 100))
  }
  return readFileSync(path, 'utf8').trim().split('\n')
}

// First, because the openers are looked up once per process, and this one decides what is on PATH.
test.runIf(linux)(
  'offers the editors and the terminal on PATH, and opens the folder in them',
  async () => {
    const bin = mkdtempSync(join(tmpdir(), 'prumo-desktop-bin-'))
    const folder = mkdtempSync(join(tmpdir(), 'prumo-desktop-folder-'))
    const editorOut = join(bin, 'editor.txt')
    const terminalOut = join(bin, 'terminal.txt')
    standIn(bin, 'code', editorOut)
    standIn(bin, 'konsole', terminalOut)
    standIn(bin, 'x-terminal-emulator', join(bin, 'unused.txt'))
    const path = process.env.PATH
    process.env.PATH = bin

    // Konsole comes before x-terminal-emulator, and only one terminal is offered.
    expect(await openers()).toEqual({ editors: ['Visual Studio Code'], terminals: ['Konsole'] })

    expect(await openIn('Visual Studio Code', folder)).toBe(true)
    expect(await readWhenWritten(editorOut)).toEqual([folder, folder])

    expect(await openIn('Konsole', folder)).toBe(true)
    expect(await readWhenWritten(terminalOut)).toEqual([folder, '--workdir', folder])
    process.env.PATH = path
  },
)

test.runIf(mac)('finds Terminal, which every Mac has', async () => {
  expect((await openers()).terminals).toContain('Terminal')
})

test.runIf(!mac && !linux)('offers nothing where it cannot open an app yet', async () => {
  expect(await openers()).toEqual({ editors: [], terminals: [] })
})

test('refuses an app it did not find, whatever the renderer asks', async () => {
  expect(await openIn('Calculator', tmpdir())).toBe(false)
})
