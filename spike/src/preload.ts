import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('spike', {
  ready: (): Promise<Record<string, string>> => ipcRenderer.invoke('spike:ready'),
  router: (info: unknown) => ipcRenderer.invoke('spike:router', info),
  onPty: (listener: (app: string, data: string) => void) =>
    ipcRenderer.on('spike:pty', (_event, app: string, data: string) => listener(app, data)),
})
