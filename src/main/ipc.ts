// Every channel the renderer can reach, in one place. The names and shapes come from the shared contract.

import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { CHANNELS, type Environment, type StartApp } from '../shared/ipc.ts'
import type { Apps } from './processes.ts'

type Wiring = {
  apps: Apps
  windows: () => BrowserWindow[]
  environment: () => Promise<Environment>
}

export function register({ apps, windows, environment }: Wiring): void {
  ipcMain.handle(CHANNELS.environment, () => environment())
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
