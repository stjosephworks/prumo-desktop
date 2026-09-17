// Every channel the renderer can reach, in one place. The names and shapes come from the shared contract.

import type { BrowserWindow } from 'electron'
import { dialog, ipcMain, shell } from 'electron'
import { CHANNELS, type Environment, type StartApp } from '../shared/ipc.ts'
import type { Apps } from './processes.ts'
import type { Projects } from './projects.ts'

type Wiring = {
  apps: Apps
  projects: Projects
  windows: () => BrowserWindow[]
  environment: () => Promise<Environment>
}

export function register({ apps, projects, windows, environment }: Wiring): void {
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
  ipcMain.handle(CHANNELS.list, () => apps.list())
  ipcMain.handle(CHANNELS.start, (_event, app: StartApp) => apps.start(app))
  ipcMain.handle(CHANNELS.stop, (_event, id: string) => apps.stop(id))
  ipcMain.handle(CHANNELS.buffer, (_event, id: string) => apps.buffer(id))
  ipcMain.handle(CHANNELS.write, (_event, id: string, data: string) => apps.write(id, data))
  ipcMain.handle(CHANNELS.resize, (_event, id: string, cols: number, rows: number) =>
    apps.resize(id, cols, rows),
  )

  // Output and state are pushed: a terminal cannot poll, and a state change has no request behind it.
  apps.on('output', (id, data) => {
    for (const window of windows()) window.webContents.send(CHANNELS.output, id, data)
  })
  apps.on('state', (app) => {
    for (const window of windows()) window.webContents.send(CHANNELS.state, app)
  })
}
