// Opening a project in the user's editor or terminal. macOS only for now: `open -a <App> <folder>` hands the folder
// to the app, as open(1) documents, and `open -Ra <App>` finds an app without opening it. No Electron here.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Openers } from '../shared/ipc.ts'

const run = promisify(execFile)

/** Editors that open a folder handed to them, in the order the Desktop offers them. */
const EDITORS = ['Visual Studio Code', 'Cursor', 'Zed', 'WebStorm']

/**
 * Terminal.app opens a new window in the folder it is handed; that was checked. Ghostty was not offered: in the
 * same check it started in another folder, its config winning over --working-directory.
 */
const TERMINALS = ['Terminal']

async function installed(app: string): Promise<boolean> {
  try {
    await run('open', ['-Ra', app])
    return true
  } catch {
    return false
  }
}

let found: Promise<Openers> | undefined

/** The editors and terminals this machine has, looked up once per launch. */
export function openers(): Promise<Openers> {
  found ??= (async () => {
    if (process.platform !== 'darwin') return { editors: [], terminals: [] }

    const has = async (apps: string[]) =>
      (
        await Promise.all(apps.map(async (app) => ((await installed(app)) ? app : undefined)))
      ).filter((app) => app !== undefined)

    return { editors: await has(EDITORS), terminals: await has(TERMINALS) }
  })()

  return found
}

/** Opens `path` in `app`, which must be one this machine was found to have: never an app the renderer names. */
export async function openIn(app: string, path: string): Promise<boolean> {
  const { editors, terminals } = await openers()

  if (![...editors, ...terminals].includes(app)) return false

  try {
    await run('open', ['-a', app, path])
    return true
  } catch {
    return false
  }
}
