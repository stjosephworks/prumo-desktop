// Against this machine's real apps on macOS; on Linux, against stand-ins put on PATH, since a CI runner has no
// editor or terminal of its own. Nothing real is opened.
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { onWindows, openers, openIn } from './open-in.ts'

const mac = process.platform === 'darwin'
const linux = process.platform === 'linux'
const windows = process.platform === 'win32'

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
  return readFileSync(path, 'utf8').trim().split(/\r?\n/)
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

// First on Windows as well: a .cmd stand-in for VS Code, and the Command Prompt, which System32 always has.
test.runIf(windows)(
  'offers the editors on PATH and a terminal, and opens the folder in them',
  async () => {
    const bin = mkdtempSync(join(tmpdir(), 'prumo-desktop-bin-'))
    // The long form of the path, which is what cmd.exe reports as the current folder.
    const folder = realpathSync.native(mkdtempSync(join(tmpdir(), 'prumo desktop folder-')))
    const out = join(bin, 'editor.txt')
    writeFileSync(join(bin, 'code.cmd'), `@echo off\r\n(echo %CD%& echo %~1)> "${out}"\r\n`)
    const path = process.env.PATH
    process.env.PATH = [bin, join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')].join(';')

    expect(await openers()).toEqual({
      editors: ['Visual Studio Code'],
      terminals: ['Command Prompt'],
    })
    expect(await openIn('Visual Studio Code', folder)).toBe(true)
    expect(await readWhenWritten(out)).toEqual([folder, folder])
    process.env.PATH = path
  },
)

test('a Windows command line quotes every part, for cmd.exe to run as written', () => {
  const cmd = process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe'
  const code = { name: 'VS Code', command: 'code', args: (folder: string) => [folder] }
  const terminal = {
    name: 'Windows Terminal',
    command: 'wt',
    args: (folder: string) => ['-d', folder],
  }

  expect(
    onWindows({ ...code, path: 'C:\\VS Code\\bin\\code.cmd' }, 'C:\\My Projects\\shop'),
  ).toEqual([cmd, ['/d', '/s', '/c', '""C:\\VS Code\\bin\\code.cmd" "C:\\My Projects\\shop""']])
  expect(onWindows({ ...terminal, path: 'C:\\wt.exe' }, 'C:\\shop')).toEqual([
    cmd,
    ['/d', '/s', '/c', '""C:\\wt.exe" "-d" "C:\\shop""'],
  ])
})

test('refuses an app it did not find, whatever the renderer asks', async () => {
  expect(await openIn('Calculator', tmpdir())).toBe(false)
})
