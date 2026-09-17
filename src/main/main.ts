// The Electron side: the window, the IPC handlers, and the promise that nothing the Desktop started outlives it.
import { join } from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import { doctor } from './cli.ts'
import { applyShellPath, findNode } from './environment.ts'
import { register } from './ipc.ts'
import { Apps } from './processes.ts'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

// Forge builds the main process as CommonJS, where `import.meta.dirname` is undefined: use `__dirname`.
const here = __dirname

// Before anything else: opened from Finder, the app would not even see the user's Node.
applyShellPath()

const apps = new Apps()

/**
 * The embedded CLI, always outside `app.asar`: `spawn` cannot run a file inside the archive.
 * In development it sits in `resources/`, written by `scripts/embed-cli.mjs`.
 */
function cliPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'prumo', 'dist', 'cli.js')
    : join(app.getAppPath(), 'resources', 'prumo', 'dist', 'cli.js')
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(here, 'preload.js'),
      // The renderer reaches Node only through the bridge in the preload.
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    window.loadFile(join(here, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  return window
}

app.whenReady().then(() => {
  register({
    apps,
    windows: () => BrowserWindow.getAllWindows(),
    environment: async () => {
      const node = await findNode()

      if (node === undefined) return { ready: false, node: undefined, checks: [] }

      const report = await doctor({ cli: cliPath() })

      return { ready: report.ready, node, checks: report.checks }
    },
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

let stopping = false

// Quitting stops every app, killing whole process trees: leaving Vite, Nest or Metro behind would
// occupy ports the Desktop can no longer recognise when it reopens.
app.on('before-quit', async (event) => {
  if (stopping) return

  const running = apps.list().filter((one) => one.state === 'running' || one.state === 'starting')

  if (running.length === 0) return

  event.preventDefault()

  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Cancel', 'Quit and stop'],
    defaultId: 1,
    cancelId: 0,
    message: running.length === 1 ? '1 app is running' : `${running.length} apps are running`,
    detail: 'Quitting Prumo Desktop stops them.',
  })

  if (response === 0) return

  stopping = true
  await apps.stopAll()
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
