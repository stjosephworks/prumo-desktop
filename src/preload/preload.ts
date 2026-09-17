// The bridge, and nothing else: it exposes the contract, never Node itself.
import { contextBridge, ipcRenderer } from 'electron'
import {
  type Bridge,
  CHANNELS,
  type NewProject,
  type RunningApp,
  type StartApp,
} from '../shared/ipc.ts'

const bridge: Bridge = {
  environment: () => ipcRenderer.invoke(CHANNELS.environment),
  projects: {
    list: () => ipcRenderer.invoke(CHANNELS.projectsList),
    add: () => ipcRenderer.invoke(CHANNELS.projectsAdd),
    remove: (path: string) => ipcRenderer.invoke(CHANNELS.projectsRemove, path),
    reveal: (path: string) => ipcRenderer.invoke(CHANNELS.projectsReveal, path),
    create: (input: NewProject) => ipcRenderer.invoke(CHANNELS.projectsCreate, input),
    chooseParent: () => ipcRenderer.invoke(CHANNELS.projectsChooseParent),
    onCreateLog: (listener) => {
      const handler = (_event: unknown, chunk: string) => listener(chunk)
      ipcRenderer.on(CHANNELS.projectsCreateLog, handler)
      return () => {
        ipcRenderer.off(CHANNELS.projectsCreateLog, handler)
      }
    },
  },
  database: {
    state: (project) => ipcRenderer.invoke(CHANNELS.databaseState, project),
    create: (project, name) => ipcRenderer.invoke(CHANNELS.databaseCreate, project, name),
    startDocker: (project) => ipcRenderer.invoke(CHANNELS.databaseStart, project),
    stopDocker: (project) => ipcRenderer.invoke(CHANNELS.databaseStop, project),
    onLog: (listener) => {
      const handler = (_event: unknown, chunk: string) => listener(chunk)
      ipcRenderer.on(CHANNELS.databaseLog, handler)
      return () => {
        ipcRenderer.off(CHANNELS.databaseLog, handler)
      }
    },
  },
  apps: {
    list: () => ipcRenderer.invoke(CHANNELS.list),
    start: (app: StartApp) => ipcRenderer.invoke(CHANNELS.start, app),
    stop: (id: string) => ipcRenderer.invoke(CHANNELS.stop, id),
    buffer: (id: string) => ipcRenderer.invoke(CHANNELS.buffer, id),
    write: (id: string, data: string) => ipcRenderer.invoke(CHANNELS.write, id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke(CHANNELS.resize, id, cols, rows),
    // Each subscription returns its own unsubscribe, so a component that unmounts leaves nothing behind.
    onOutput: (listener) => {
      const handler = (_event: unknown, id: string, data: string) => listener(id, data)
      ipcRenderer.on(CHANNELS.output, handler)
      return () => {
        ipcRenderer.off(CHANNELS.output, handler)
      }
    },
    onState: (listener) => {
      const handler = (_event: unknown, app: RunningApp) => listener(app)
      ipcRenderer.on(CHANNELS.state, handler)
      return () => {
        ipcRenderer.off(CHANNELS.state, handler)
      }
    },
  },
}

contextBridge.exposeInMainWorld('prumo', bridge)
