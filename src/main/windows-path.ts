// The PATH an app opened from the Start menu should have on Windows. No Electron here.
//
// An app inherits the environment Explorer had when the user logged in, so a Node installed since, or a PATH entry a
// version manager added since, is missing from it; fix-path does nothing on Windows, and a version manager that
// lives in a PowerShell profile (fnm) is never run, by decision. So, in order:
//   1. the user's and the system's environment, read from the registry, `%VAR%` expanded, as a new login would;
//   2. if Node or pnpm is still missing, the folders the usual installers put them in;
//   3. if Node is still missing, the one the user picked by hand (src/main/environment.ts, src/main/settings.ts).
import { execFile } from 'node:child_process'
import { win32 } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Environment variables as the registry holds them: values unexpanded, names in their own case. */
export type Variables = Record<string, string>

export type RegistryEnvironment = { system: Variables; user: Variables }

/**
 * Both environment keys, read through .NET's registry API with `DoNotExpandEnvironmentNames`, so every value comes
 * back as stored and is expanded here, in one place. PowerShell runs with `-NoProfile`: no profile is ever run.
 * UTF-8 output, because a user folder can hold any character and the console's code page cannot.
 */
const READ_ENVIRONMENT = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$read = {
  param($key)
  $values = @{}
  if ($null -ne $key) {
    foreach ($name in $key.GetValueNames()) {
      $values[$name] = [string]$key.GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    }
  }
  $values
}
@{
  system = & $read ([Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'))
  user = & $read ([Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment'))
} | ConvertTo-Json -Compress
`

/** Windows PowerShell where every Windows has it: an inherited PATH may not name its folder. */
function powershell(): string {
  return win32.join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  )
}

/** Asynchronous: PowerShell takes seconds to start on a cold machine, and the window must not wait for it. */
export async function readRegistryEnvironment(): Promise<RegistryEnvironment> {
  const { stdout } = await run(
    powershell(),
    ['-NoProfile', '-NonInteractive', '-Command', READ_ENVIRONMENT],
    { encoding: 'utf8', windowsHide: true, timeout: 60_000 },
  )
  const parsed = JSON.parse(stdout) as Partial<RegistryEnvironment>

  return { system: parsed.system ?? {}, user: parsed.user ?? {} }
}

/** Looks a variable up as Windows does, whatever the case of its name. */
function lookup(variables: Variables, name: string): string | undefined {
  const key = Object.keys(variables).find((one) => one.toLowerCase() === name.toLowerCase())
  return key === undefined ? undefined : variables[key]
}

/** `%NAME%` replaced by its value; an unknown name is left as it is, which is what Windows does too. */
export function expand(value: string, variables: Variables): string {
  return value.replace(/%([^%;]+)%/g, (whole, name: string) => lookup(variables, name) ?? whole)
}

/** PATH entries, without empty ones or repeats, compared as Windows compares paths: ignoring case and a trailing slash. */
export function joinPath(...lists: string[][]): string {
  const seen = new Set<string>()
  const entries: string[] = []

  for (const entry of lists.flat()) {
    const trimmed = entry.trim()
    const key = trimmed.replace(/[\\/]+$/, '').toLowerCase()
    if (trimmed === '' || seen.has(key)) continue
    seen.add(key)
    entries.push(trimmed)
  }

  return entries.join(';')
}

const split = (path: string | undefined) => (path ?? '').split(';')

/**
 * The environment a fresh login would give: the system's variables, then the user's over them, each expanded
 * against what came before and the process's own (USERPROFILE, LOCALAPPDATA). PATH is the system's followed by the
 * user's, as Windows builds it, then whatever the process already had that the registry does not name.
 * Only variables the process lacks are added; PATH is the one that is rebuilt.
 */
export function loginEnvironment(
  registry: RegistryEnvironment,
  current: Record<string, string | undefined>,
): Record<string, string> {
  const known: Variables = Object.fromEntries(
    Object.entries(current).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
  const expanded: Variables = {}

  for (const scope of [registry.system, registry.user]) {
    for (const [name, value] of Object.entries(scope)) {
      if (name.toLowerCase() === 'path') continue
      expanded[name] = expand(value, { ...known, ...expanded })
    }
  }

  const all = { ...known, ...expanded }
  const systemPath = expand(lookup(registry.system, 'Path') ?? '', all)
  const userPath = expand(lookup(registry.user, 'Path') ?? '', all)

  const added = Object.fromEntries(
    Object.entries(expanded).filter(([name]) => lookup(known, name) === undefined),
  )

  return {
    ...added,
    PATH: joinPath(split(systemPath), split(userPath), split(lookup(known, 'Path'))),
  }
}

/**
 * Where the usual installers put Node, when no PATH names it: the official installer, nvm-windows' symlink
 * (NVM_SYMLINK, `C:\nvm4w\nodejs` by its installer's default), Volta's shims (`%VOLTA_HOME%\bin`,
 * `%LOCALAPPDATA%\Volta` by default, and the Program Files folder its installer adds), and fnm's default alias
 * (`<FNM_DIR>\aliases\default`, `%APPDATA%\fnm` by default or the legacy `%USERPROFILE%\.fnm`, node.exe at its root
 * on Windows). Corepack's shims live beside node.exe, so they come with it.
 */
export function nodeLocations(env: Record<string, string | undefined>): string[] {
  const at = (base: string | undefined, ...parts: string[]) =>
    base === undefined || base === '' ? [] : [win32.join(base, ...parts)]

  return [
    ...at(env.ProgramFiles, 'nodejs'),
    ...at(env.NVM_SYMLINK),
    'C:\\nvm4w\\nodejs',
    ...at(env.VOLTA_HOME, 'bin'),
    ...at(env.LOCALAPPDATA, 'Volta', 'bin'),
    ...at(env.ProgramFiles, 'Volta'),
    ...at(env.FNM_DIR, 'aliases', 'default'),
    ...at(env.APPDATA, 'fnm', 'aliases', 'default'),
    ...at(env.USERPROFILE, '.fnm', 'aliases', 'default'),
  ]
}

/**
 * Where pnpm usually is, when no PATH names it: `pnpm setup`'s home (PNPM_HOME, `%LOCALAPPDATA%\pnpm` by default,
 * linked into `bin` there since v11) and npm's global prefix (`%AppData%\npm`), where `npm install -g pnpm` puts it.
 */
export function pnpmLocations(env: Record<string, string | undefined>): string[] {
  const at = (base: string | undefined, ...parts: string[]) =>
    base === undefined || base === '' ? [] : [win32.join(base, ...parts)]

  return [
    ...at(env.PNPM_HOME, 'bin'),
    ...at(env.PNPM_HOME),
    ...at(env.LOCALAPPDATA, 'pnpm', 'bin'),
    ...at(env.LOCALAPPDATA, 'pnpm'),
    ...at(env.APPDATA, 'npm'),
  ]
}
