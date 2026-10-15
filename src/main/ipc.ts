// Every channel the renderer can reach, in one place. The names and shapes come from the shared contract.

import type { BrowserWindow } from 'electron'
import { clipboard, dialog, ipcMain, shell } from 'electron'
import type { PortAnswer, Project, ProjectConfig } from '../shared/ipc.ts'
import {
  type AppUpdate,
  CHANNELS,
  type CliStatus,
  type Environment,
  type NewProject,
  type StartApp,
} from '../shared/ipc.ts'
import { isLocale, type Locale } from '../shared/locales.ts'
import { createProject } from './create.ts'
import {
  createDatabase,
  databaseState,
  dockerState,
  openDocker,
  startDocker,
  stopDocker,
} from './database.ts'
import { documentPath, readDocument } from './docs.ts'
import { applyShellPath } from './environment.ts'
import { gitState } from './git.ts'
import { apiHealth } from './health.ts'
import type { MainDictionary } from './i18n/en.ts'
import { openers, openIn } from './open-in.ts'
import { checkPort } from './ports.ts'
import type { Apps } from './processes.ts'
import type { Projects } from './projects.ts'

type Wiring = {
  /** The newer Desktop the notice last found, if any. */
  appUpdate: () => AppUpdate | undefined
  cliStatus: () => Promise<CliStatus>
  cliUpdate: () => Promise<{ ok: true; status: CliStatus } | { ok: false; message: string }>
  apps: Apps
  projects: Projects
  windows: () => BrowserWindow[]
  environment: () => Promise<Environment>
  /** Keeps a node executable the user picked; false when it does not run as Node. */
  keepNode: (path: string) => Promise<boolean>
  /** Where the embedded CLI is, which only the Electron side knows. */
  cli: () => string
  /** The words of the language in use, for the native dialogs opened from here. */
  words: () => MainDictionary
  locale: {
    get: () => { locale: Locale; chosen: boolean }
    /** Keeps the choice, or forgets it on undefined, and switches every surface; the language now in use. */
    set: (locale: Locale | undefined) => Locale
  }
}

export function register({
  apps,
  projects,
  windows,
  environment,
  keepNode,
  cli,
  cliStatus,
  cliUpdate,
  appUpdate,
  words,
  locale,
}: Wiring): void {
  // Every channel waits for the PATH the Desktop runs commands with, which Windows reads in the background.
  const handle: typeof ipcMain.handle = (channel, listener) =>
    ipcMain.handle(channel, async (event, ...args) => {
      await applyShellPath()
      return listener(event, ...args)
    })

  const send = (channel: string, ...args: unknown[]) => {
    for (const window of windows()) window.webContents.send(channel, ...args)
  }

  handle(CHANNELS.environment, () => environment())
  handle(CHANNELS.localeGet, () => locale.get())
  handle(CHANNELS.localeSet, (_event, chosen: unknown) => {
    // Anything but a known language or undefined is refused, so the settings never keep one the app cannot speak.
    if (chosen !== undefined && !isLocale(chosen)) return locale.get().locale
    return locale.set(chosen)
  })
  handle(CHANNELS.chooseNode, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      message: words().dialogs.chooseNode,
      ...(process.platform === 'win32' ? { filters: [{ name: 'Node', extensions: ['exe'] }] } : {}),
    })
    const [chosen] = filePaths

    if (canceled || chosen === undefined) return { ok: false as const, reason: 'canceled' as const }
    if (!(await keepNode(chosen))) return { ok: false as const, reason: 'not_node' as const }

    return { ok: true as const, environment: await environment() }
  })
  handle(CHANNELS.appUpdate, () => appUpdate())
  handle(CHANNELS.cliStatus, () => cliStatus())
  handle(CHANNELS.cliUpdate, () => cliUpdate())

  handle(CHANNELS.projectsList, () => projects.list())
  handle(CHANNELS.projectsAdd, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      message: words().dialogs.chooseProject,
    })
    const [chosen] = filePaths

    // The CLI owns what a project is; the Desktop only checks for the file that says so.
    return canceled || chosen === undefined ? undefined : projects.add(chosen)
  })
  handle(CHANNELS.projectsRemove, (_event, path: string) => projects.remove(path))
  handle(CHANNELS.projectsReveal, (_event, path: string) => shell.openPath(path))
  handle(CHANNELS.projectsOpeners, () => openers())
  handle(CHANNELS.projectsGit, (_event, path: string) => gitState(path))
  handle(CHANNELS.projectsOpenIn, (_event, app: string, path: string) => openIn(app, path))
  handle(CHANNELS.projectsChooseParent, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      message: words().dialogs.chooseParent,
    })

    return canceled ? undefined : filePaths[0]
  })
  handle(CHANNELS.projectsCreate, (_event, input: NewProject) =>
    // The log is the CLI's stderr, streamed while it runs: `pnpm install` is most of the wait.
    createProject(input, projects, {
      cli: cli(),
      onLog: (chunk) => send(CHANNELS.projectsCreateLog, chunk),
    }),
  )
  handle(CHANNELS.docsRead, async (_event, project: string, document?: string) => {
    try {
      return { ok: true as const, text: await readDocument(project, document) }
    } catch (problem) {
      return { ok: false as const, message: (problem as Error).message }
    }
  })
  handle(CHANNELS.docsOpenInEditor, (_event, project: string, document: string) =>
    shell.openPath(documentPath(project, document)),
  )
  handle(CHANNELS.copy, (_event, text: string) => clipboard.writeText(text))
  handle(CHANNELS.openExternal, (_event, url: string) => {
    // Only the web goes to the browser; anything else would be a way to open arbitrary files.
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })

  handle(CHANNELS.databaseState, async (_event, project: Project) => ({
    database: await databaseState(project, { cli: cli() }),
    docker: await dockerState(project),
  }))
  handle(CHANNELS.databaseCreate, (_event, project: Project, name: string) =>
    createDatabase(project, name, {
      cli: cli(),
      onLog: (chunk) => send(CHANNELS.databaseLog, chunk),
    }),
  )
  handle(CHANNELS.databaseStart, (_event, project: Project) => startDocker(project))
  handle(CHANNELS.databaseStop, (_event, project: Project) => stopDocker(project))
  handle(CHANNELS.databaseOpenDocker, () => openDocker())

  handle(CHANNELS.list, () => apps.list())
  handle(
    CHANNELS.checkPort,
    (_event, project: Project, type: ProjectConfig['types'][number], answer?: PortAnswer) =>
      checkPort(project, type, answer),
  )
  handle(CHANNELS.health, (_event, port: number) => apiHealth(port))
  handle(CHANNELS.start, (_event, app: StartApp) => apps.start(app))
  handle(CHANNELS.stop, (_event, id: string) => apps.stop(id))
  handle(CHANNELS.buffer, (_event, id: string) => apps.buffer(id))
  handle(CHANNELS.write, (_event, id: string, data: string) => apps.write(id, data))
  handle(CHANNELS.resize, (_event, id: string, cols: number, rows: number) =>
    apps.resize(id, cols, rows),
  )

  // Output and state are pushed: a terminal cannot poll, and a state change has no request behind it.
  apps.on('output', (id, data) => send(CHANNELS.output, id, data))
  apps.on('state', (app) => send(CHANNELS.state, app))
}
