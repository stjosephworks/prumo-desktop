// Opening a project in the user's editor or terminal. No Electron here.
//
// macOS: `open -a <App> <folder>` hands the folder to the app, as open(1) documents, and `open -Ra <App>` finds an
// app without opening it.
// Linux: each editor's own command on PATH (`code`, `cursor`, `zed`) opens the folder handed to it, and the
// terminal is the first one found of GNOME Terminal (`--working-directory`, gnome-terminal(1)), Konsole
// (`--workdir`) and Debian's `x-terminal-emulator`, which is started in the folder.
// Windows: the same editors through their commands on PATH, which are .cmd files run through cmd.exe, and Windows
// Terminal (`wt -d <folder>`, Microsoft's command line reference), or else a Command Prompt started in the folder.
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { Openers } from '../shared/ipc.ts'
import { findOnPath } from './environment.ts'

const run = promisify(execFile)

/** Editors that open a folder handed to them, in the order the Desktop offers them. */
const MAC_EDITORS = ['Visual Studio Code', 'Cursor', 'Zed', 'WebStorm']

/**
 * Terminal.app opens a new window in the folder it is handed; that was checked. Ghostty was not offered: in the
 * same check it started in another folder, its config winning over --working-directory.
 */
const MAC_TERMINALS = ['Terminal']

/** An app found on PATH: the name the Desktop shows, its command, and how the folder is handed to it. */
type LinuxApp = { name: string; command: string; args: (folder: string) => string[] }

const LINUX_EDITORS: LinuxApp[] = [
  { name: 'Visual Studio Code', command: 'code', args: (folder) => [folder] },
  { name: 'Cursor', command: 'cursor', args: (folder) => [folder] },
  { name: 'Zed', command: 'zed', args: (folder) => [folder] },
]

/** Only the first one found is offered: a machine has one terminal it calls its own. */
const LINUX_TERMINALS: LinuxApp[] = [
  {
    name: 'GNOME Terminal',
    command: 'gnome-terminal',
    args: (folder) => [`--working-directory=${folder}`],
  },
  { name: 'Konsole', command: 'konsole', args: (folder) => ['--workdir', folder] },
  // Debian's alternative for the user's chosen terminal takes no folder: it starts where it is started.
  { name: 'Terminal', command: 'x-terminal-emulator', args: () => [] },
]

/**
 * Windows Terminal reads `;` as the end of a command, so one in the folder's name is escaped. The Command Prompt
 * has no command to find: cmd.exe is always there, and `start` opens it in a window of its own.
 */
const WINDOWS_TERMINALS: LinuxApp[] = [
  {
    name: 'Windows Terminal',
    command: 'wt',
    args: (folder) => ['-d', folder.replaceAll(';', '\\;')],
  },
  { name: 'Command Prompt', command: 'cmd', args: () => [] },
]

async function installedOnMac(app: string): Promise<boolean> {
  try {
    await run('open', ['-Ra', app])
    return true
  } catch {
    return false
  }
}

/** The apps this machine has, found on PATH and kept with the path they were found at. */
function pathApps(): {
  editors: (LinuxApp & { path: string })[]
  terminal?: LinuxApp & { path: string }
} {
  const found = (apps: LinuxApp[]) =>
    apps.flatMap((app) => {
      const path = findOnPath(app.command)
      return path === undefined ? [] : [{ ...app, path }]
    })

  const windows = process.platform === 'win32'

  // The editors' commands are the same on Windows, as .cmd files that findOnPath finds through PATHEXT.
  return {
    editors: found(LINUX_EDITORS),
    terminal: found(windows ? WINDOWS_TERMINALS : LINUX_TERMINALS)[0],
  }
}

let found: Promise<Openers> | undefined

/** The editors and terminals this machine has, looked up once per launch. */
export function openers(): Promise<Openers> {
  found ??= (async () => {
    if (process.platform === 'darwin') {
      const has = async (apps: string[]) =>
        (
          await Promise.all(
            apps.map(async (app) => ((await installedOnMac(app)) ? app : undefined)),
          )
        ).filter((app) => app !== undefined)

      return { editors: await has(MAC_EDITORS), terminals: await has(MAC_TERMINALS) }
    }

    if (process.platform === 'linux' || process.platform === 'win32') {
      const { editors, terminal } = pathApps()

      return {
        editors: editors.map((editor) => editor.name),
        terminals: terminal === undefined ? [] : [terminal.name],
      }
    }

    return { editors: [], terminals: [] }
  })()

  return found
}

/** Starts `command` on its own, so it outlives neither a wait here nor the Desktop's own exit. */
function detached(
  command: string,
  args: string[],
  cwd: string,
  verbatim = false,
): Promise<boolean> {
  return new Promise((done) => {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      stdio: 'ignore',
      env: process.env,
      windowsVerbatimArguments: verbatim,
    })
    child.once('error', () => done(false))
    child.once('spawn', () => {
      child.unref()
      done(true)
    })
  })
}

/**
 * The command line for an app on Windows, for cmd.exe: a .cmd runs only through it, and `start` opens the Command
 * Prompt in a window of its own. A Windows path cannot hold a double quote, so quoting each part is enough, and
 * `/s /c` with the whole line in one more pair of quotes runs it as written (cmd /?).
 */
export function onWindows(app: LinuxApp & { path: string }, folder: string): [string, string[]] {
  const cmd = process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe'
  const quote = (part: string) => `"${part}"`

  if (app.command === 'cmd') {
    return [cmd, ['/d', '/s', '/c', `"start "" /D ${quote(folder)} ${quote(cmd)}"`]]
  }

  return [cmd, ['/d', '/s', '/c', `"${[app.path, ...app.args(folder)].map(quote).join(' ')}"`]]
}

/** Opens `path` in `app`, which must be one this machine was found to have: never an app the renderer names. */
export async function openIn(app: string, path: string): Promise<boolean> {
  const { editors, terminals } = await openers()

  if (![...editors, ...terminals].includes(app)) return false

  if (process.platform === 'linux' || process.platform === 'win32') {
    const { editors: pathEditors, terminal } = pathApps()
    const chosen = [...pathEditors, ...(terminal === undefined ? [] : [terminal])].find(
      (one) => one.name === app,
    )

    if (chosen === undefined) return false
    if (process.platform === 'linux') return detached(chosen.path, chosen.args(path), path)

    const [command, args] = onWindows(chosen, path)
    return detached(command, args, path, true)
  }

  try {
    await run('open', ['-a', app, path])
    return true
  } catch {
    return false
  }
}
