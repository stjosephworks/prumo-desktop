// Every channel the renderer can reach, in one place. The names and shapes come from the shared contract.

import type { BrowserWindow } from 'electron'
import { dialog, ipcMain, shell } from 'electron'
import type { Project } from '../shared/ipc.ts'
import { CHANNELS, type Environment, type NewProject, type StartApp } from '../shared/ipc.ts'
import { createProject } from './create.ts'
import { createDatabase, databaseState, dockerState, startDocker, stopDocker } from './database.ts'
import type { Apps } from './processes.ts'
import type { Projects } from './projects.ts'

type Wiring = {
  apps: Apps
  projects: Projects
  windows: () => BrowserWindow[]
  environment: () => Promise<Environment>
  /** Where the embedded CLI is, which only the Electron side knows. */
  cli: () => string
}

export function register({ apps, projects, windows, environment, cli }: Wiring): void {
  const send = (channel: string, ...args: unknown[]) => {
    for (const window of windows()) window.webContents.send(channel, ...args)
  }

  ipcMain.handle(CHANNELS.environment, () => environment())

  ipcMain.handle(CHANNELS.projectsList, () => projects.list())
  ipcMain.handle(CHANNELS.projectsAdd, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      message: 'Choose a folder that holds a .prumo/config.json',
    })
    const [chosen] = filePaths

    // The CLI owns what a project is; the Desktop only checks for the file that says so.
    return canceled || chosen === undefined ? undefined : projects.add(chosen)
  })
  ipcMain.handle(CHANNELS.projectsRemove, (_event, path: string) => projects.remove(path))
  ipcMain.handle(CHANNELS.projectsReveal, (_event, path: string) => shell.openPath(path))
  ipcMain.handle(CHANNELS.projectsChooseParent, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      message: 'Choose where the new project folder goes',
    })

    return canceled ? undefined : filePaths[0]
  })
  ipcMain.handle(CHANNELS.projectsCreate, (_event, input: NewProject) =>
    // The log is the CLI's stderr, streamed while it runs: `pnpm install` is most of the wait.
    createProject(input, projects, {
      cli: cli(),
      onLog: (chunk) => send(CHANNELS.projectsCreateLog, chunk),
    }),
  )
  ipcMain.handle(CHANNELS.databaseState, async (_event, project: Project) => ({
    database: await databaseState(project, { cli: cli() }),
    docker: await dockerState(project),
  }))
  ipcMain.handle(CHANNELS.databaseCreate, (_event, project: Project, name: string) =>
    createDatabase(project, name, {
      cli: cli(),
      onLog: (chunk) => send(CHANNELS.databaseLog, chunk),
    }),
  )
  ipcMain.handle(CHANNELS.databaseStart, (_event, project: Project) => startDocker(project))
  ipcMain.handle(CHANNELS.databaseStop, (_event, project: Project) => stopDocker(project))

  ipcMain.handle(CHANNELS.list, () => apps.list())
  ipcMain.handle(CHANNELS.start, (_event, app: StartApp) => apps.start(app))
  ipcMain.handle(CHANNELS.stop, (_event, id: string) => apps.stop(id))
  ipcMain.handle(CHANNELS.buffer, (_event, id: string) => apps.buffer(id))
  ipcMain.handle(CHANNELS.write, (_event, id: string, data: string) => apps.write(id, data))
  ipcMain.handle(CHANNELS.resize, (_event, id: string, cols: number, rows: number) =>
    apps.resize(id, cols, rows),
  )

  // Output and state are pushed: a terminal cannot poll, and a state change has no request behind it.
  apps.on('output', (id, data) => send(CHANNELS.output, id, data))
  apps.on('state', (app) => send(CHANNELS.state, app))
}
