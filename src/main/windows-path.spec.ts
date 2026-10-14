// The rules against made-up registries everywhere; on Windows, the real registry, and a Node found with a PATH that
// names none.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { applyWindowsPath, findOnPath } from './environment.ts'
import {
  expand,
  joinPath,
  loginEnvironment,
  nodeLocations,
  pnpmLocations,
  readRegistryEnvironment,
} from './windows-path.ts'

const windows = process.platform === 'win32'

test('%NAME% expands whatever its case, and an unknown one stays as Windows leaves it', () => {
  const variables = { USERPROFILE: 'C:\\Users\\leo', SystemRoot: 'C:\\Windows' }

  expect(expand('%userprofile%\\bin;%SYSTEMROOT%\\System32', variables)).toBe(
    'C:\\Users\\leo\\bin;C:\\Windows\\System32',
  )
  expect(expand('%NOT_SET%\\bin', variables)).toBe('%NOT_SET%\\bin')
})

test('PATH entries keep their order and lose repeats, compared as Windows compares paths', () => {
  expect(joinPath(['C:\\A', 'c:\\a\\', ''], ['C:\\B', 'C:\\A'])).toBe('C:\\A;C:\\B')
})

test('a fresh login: the system PATH, then the user PATH, then what the process had, all expanded', () => {
  const environment = loginEnvironment(
    {
      system: {
        Path: '%SystemRoot%\\System32;C:\\Program Files\\nodejs',
        NVM_SYMLINK: 'C:\\nvm4w\\nodejs',
      },
      user: { Path: '%PNPM_HOME%;%USERPROFILE%\\bin', PNPM_HOME: '%LOCALAPPDATA%\\pnpm' },
    },
    {
      SystemRoot: 'C:\\Windows',
      USERPROFILE: 'C:\\Users\\leo',
      LOCALAPPDATA: 'C:\\Users\\leo\\AppData\\Local',
      Path: 'C:\\Windows\\System32;C:\\Inherited',
    },
  )

  expect(environment.PATH).toBe(
    [
      'C:\\Windows\\System32',
      'C:\\Program Files\\nodejs',
      'C:\\Users\\leo\\AppData\\Local\\pnpm',
      'C:\\Users\\leo\\bin',
      'C:\\Inherited',
    ].join(';'),
  )
  // Variables set since the login are added; the ones the process has are left alone.
  expect(environment.PNPM_HOME).toBe('C:\\Users\\leo\\AppData\\Local\\pnpm')
  expect(environment.NVM_SYMLINK).toBe('C:\\nvm4w\\nodejs')
  expect(environment.SystemRoot).toBeUndefined()
})

test('the usual install folders of Node and pnpm, from the variables that name them', () => {
  const env = {
    ProgramFiles: 'C:\\Program Files',
    LOCALAPPDATA: 'C:\\Users\\leo\\AppData\\Local',
    APPDATA: 'C:\\Users\\leo\\AppData\\Roaming',
    USERPROFILE: 'C:\\Users\\leo',
  }

  expect(nodeLocations(env)).toEqual([
    'C:\\Program Files\\nodejs',
    'C:\\nvm4w\\nodejs',
    'C:\\Users\\leo\\AppData\\Local\\Volta\\bin',
    'C:\\Program Files\\Volta',
    'C:\\Users\\leo\\AppData\\Roaming\\fnm\\aliases\\default',
    'C:\\Users\\leo\\.fnm\\aliases\\default',
  ])
  expect(pnpmLocations(env)).toEqual([
    'C:\\Users\\leo\\AppData\\Local\\pnpm\\bin',
    'C:\\Users\\leo\\AppData\\Local\\pnpm',
    'C:\\Users\\leo\\AppData\\Roaming\\npm',
  ])
})

test.runIf(windows)('reads this machine’s registry, whose system PATH names System32', async () => {
  const registry = await readRegistryEnvironment()
  const path = Object.entries(registry.system).find(([name]) => name.toLowerCase() === 'path')?.[1]

  expect(path?.toLowerCase()).toContain('system32')
})

const saved = { ...process.env }
afterEach(() => {
  for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name]
  Object.assign(process.env, saved)
})

test.runIf(windows)(
  'with no registry to read, Node is found in a usual install folder',
  async () => {
    const programFiles = mkdtempSync(join(tmpdir(), 'prumo-desktop-programs-'))
    mkdirSync(join(programFiles, 'nodejs'))
    writeFileSync(join(programFiles, 'nodejs', 'node.exe'), '')
    process.env.PATH = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')
    process.env.ProgramFiles = programFiles

    await applyWindowsPath(() => ({ system: {}, user: {} }))

    expect(findOnPath('node')).toBe(join(programFiles, 'nodejs', 'node.exe'))
  },
)

// The app opened from the Start menu, at its barest: a PATH with System32 alone. A real Node has to come from the
// registry or a usual folder, and run.
test.runIf(windows)(
  'with only System32 on PATH, the Desktop still finds a Node that runs',
  () => {
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
    const script = join(mkdtempSync(join(tmpdir(), 'prumo-desktop-minimal-')), 'find.mjs')
    const environment = join(import.meta.dirname, 'environment.ts').replaceAll('\\', '/')
    writeFileSync(
      script,
      `import { findNode } from 'file:///${environment}'\nconsole.log(JSON.stringify(await findNode()))\n`,
    )

    const output = execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      env: {
        SystemRoot: systemRoot,
        USERPROFILE: process.env.USERPROFILE,
        LOCALAPPDATA: process.env.LOCALAPPDATA,
        APPDATA: process.env.APPDATA,
        ProgramFiles: process.env.ProgramFiles,
        PATH: join(systemRoot, 'System32'),
      },
    })
    const node = JSON.parse(output.trim().split('\n').at(-1) ?? 'null') as {
      path: string
      version: string
    } | null

    expect(node?.path).toMatch(/node\.exe$/i)
    expect(Number(node?.version.split('.')[0])).toBeGreaterThanOrEqual(18)
  },
  120_000,
)
