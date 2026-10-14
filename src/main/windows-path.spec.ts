// The rules against made-up registries everywhere; on Windows, the real registry, and a Node found with a PATH that
// names none.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { applyWindowsPath, findOnPath, pathProblem } from './environment.ts'
import {
  ATTEMPTS_MS,
  expand,
  gitLocations,
  joinPath,
  loginEnvironment,
  nodeLocations,
  parseRegistryOutput,
  pnpmLocations,
  RegistryReadError,
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

/** A line as the PowerShell script prints it. */
const line = (scope: string, name: string, value: string) =>
  `${scope} ${Buffer.from(name).toString('base64')} ${Buffer.from(value).toString('base64')}`

test('the script’s lines come back as both scopes, any character included', () => {
  const output = [
    line('system', 'Path', '%SystemRoot%\\System32'),
    line('user', 'Path', 'C:\\Users\\João\\bin'),
    line('user', 'EMPTY', ''),
    'a warning PowerShell printed',
    '',
  ].join('\r\n')

  expect(parseRegistryOutput(output)).toEqual({
    system: { Path: '%SystemRoot%\\System32' },
    user: { Path: 'C:\\Users\\João\\bin', EMPTY: '' },
  })
})

const good = line('system', 'Path', 'C:\\Windows\\System32')

test('a read that fails is tried once more, with a longer limit, and both attempts are logged', async () => {
  const limits: number[] = []
  const log: string[] = []
  const environment = await readRegistryEnvironment(
    async (timeoutMs) => {
      limits.push(timeoutMs)
      if (limits.length === 1) throw new Error('Command failed: powershell.exe timed out')
      return good
    },
    (entry) => log.push(entry),
  )

  expect(environment.system).toEqual({ Path: 'C:\\Windows\\System32' })
  expect(limits).toEqual(ATTEMPTS_MS)
  expect(log).toHaveLength(2)
  expect(log[0]).toMatch(/attempt 1 of 2: failed after \d+ ms, because Command failed/)
  expect(log[1]).toMatch(/attempt 2 of 2: read in \d+ ms/)
})

test('a read without a system Path is not used: it is tried again', async () => {
  let calls = 0
  const environment = await readRegistryEnvironment(
    async () => (++calls === 1 ? line('user', 'Path', 'C:\\x') : good),
    () => {},
  )

  expect(calls).toBe(2)
  expect(environment.system.Path).toBe('C:\\Windows\\System32')
})

test('when both attempts fail, the error names both reasons', async () => {
  const read = readRegistryEnvironment(
    async () => {
      throw new Error('spawn EACCES')
    },
    () => {},
  )

  await expect(read).rejects.toBeInstanceOf(RegistryReadError)
  await expect(read).rejects.toThrow('attempt 1: spawn EACCES; attempt 2: spawn EACCES')
})

test('a read that never works is kept as the reason, for the This machine screen', async () => {
  const path = process.env.PATH
  await applyWindowsPath(() => {
    throw new RegistryReadError(
      'The PATH could not be read from the registry: attempt 1: x; attempt 2: y.',
    )
  })
  expect(pathProblem()).toContain('attempt 2: y')

  await applyWindowsPath(() => ({ system: { Path: path ?? '' }, user: {} }))
  expect(pathProblem()).toBeUndefined()
  process.env.PATH = path
})

test('git’s usual folders: Git for Windows for all users, 32-bit and per user, and Scoop’s shims', () => {
  expect(
    gitLocations({
      ProgramFiles: 'C:\\Program Files',
      'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      LOCALAPPDATA: 'C:\\Users\\leo\\AppData\\Local',
      USERPROFILE: 'C:\\Users\\leo',
    }),
  ).toEqual([
    'C:\\Program Files\\Git\\cmd',
    'C:\\Program Files (x86)\\Git\\cmd',
    'C:\\Users\\leo\\AppData\\Local\\Programs\\Git\\cmd',
    'C:\\Users\\leo\\scoop\\shims',
  ])
})

test.runIf(windows)('with no registry to read, git is found in its usual folder', async () => {
  const programFiles = mkdtempSync(join(tmpdir(), 'prumo-desktop-programs-'))
  mkdirSync(join(programFiles, 'Git', 'cmd'), { recursive: true })
  writeFileSync(join(programFiles, 'Git', 'cmd', 'git.exe'), '')
  process.env.PATH = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')
  process.env.ProgramFiles = programFiles

  await applyWindowsPath(() => ({ system: {}, user: {} }))

  expect(findOnPath('git')).toBe(join(programFiles, 'Git', 'cmd', 'git.exe'))
})
