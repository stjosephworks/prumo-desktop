// The Electron side: the window, the IPC handlers, and the promise that nothing the Desktop started outlives it.
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, Notification } from 'electron'
import { CHANNELS, type CliStatus, type RunningApp } from '../shared/ipc.ts'
import { doctor } from './cli.ts'
import { activeCli, installCli, publishedVersions, statusOf } from './cli-update.ts'
import { applyShellPath, findNode } from './environment.ts'
import { register } from './ipc.ts'
import { Apps } from './processes.ts'
import { Projects } from './projects.ts'
import { createTray } from './tray.ts'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

// Forge builds the main process as CommonJS, where `import.meta.dirname` is undefined: use `__dirname`.
const here = __dirname

// Before anything else: opened from Finder, the app would not even see the user's Node.
applyShellPath()

const apps = new Apps()
// The list of projects the user keeps, beside the app's own data: nothing of it belongs in a project.
const projects = new Projects(join(app.getPath('userData'), 'projects.json'))

/**
 * The embedded CLI, always outside `app.asar`: `spawn` cannot run a file inside the archive.
 * In development it sits in `resources/`, written by `scripts/embed-cli.mjs`.
 */
function shippedCli(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'prumo', 'dist', 'cli.js')
    : join(app.getAppPath(), 'resources', 'prumo', 'dist', 'cli.js')
}

/** Where a newer CLI of the same minor is installed, since the one in the bundle cannot change. */
const cliUpdates = join(app.getPath('userData'), 'prumo')

/** Decided on every call, so a CLI updated a moment ago is the one the next command runs. */
function cliPath(): string {
  return activeCli(shippedCli(), cliUpdates).path
}

// The registry is asked once per launch: each screen that shows the status would otherwise ask again.
let published: Promise<string[]> | undefined

async function cliStatus(): Promise<CliStatus> {
  const active = activeCli(shippedCli(), cliUpdates)
  published ??= publishedVersions()

  try {
    return statusOf(active, await published)
  } catch (problem) {
    published = undefined
    return { version: active.version, source: active.source, error: (problem as Error).message }
  }
}

let updating: Promise<{ ok: true; status: CliStatus } | { ok: false; message: string }> | undefined

/** One update at a time: a second click joins the one already running. */
function cliUpdate() {
  updating ??= (async () => {
    const { available } = await cliStatus()

    if (available === undefined)
      return { ok: false as const, message: 'There is nothing to update to.' }

    try {
      await installCli(available, cliUpdates)
      return { ok: true as const, status: await cliStatus() }
    } catch (problem) {
      return { ok: false as const, message: (problem as Error).message }
    }
  })().finally(() => {
    updating = undefined
  })

  return updating
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

/** Brings the window forward, making one if none is open, on a project when one is given. */
function showWindow(project?: string): void {
  const window = BrowserWindow.getAllWindows()[0] ?? createWindow()
  window.show()
  window.focus()
  if (project !== undefined) window.webContents.send(CHANNELS.navigate, project)
}

// Held for the app's lifetime: a tray nothing refers to can be collected, and its icon would vanish.
const held: object[] = []

/**
 * What happens outside the window: the Dock badge counts what runs, and a process that fails while the window is
 * in the background says so in a notification, which brings the window back on that project when clicked.
 */
function watchApps(): void {
  const failed = new Set<string>()

  apps.on('state', (changed: RunningApp) => {
    const running = apps.list().filter((one) => one.state === 'running' || one.state === 'starting')
    app.setBadgeCount(running.length)

    if (changed.state !== 'failed') {
      failed.delete(changed.id)
      return
    }
    // One notification per failure, and none while the user is looking at the window.
    if (failed.has(changed.id) || BrowserWindow.getFocusedWindow() !== null) return
    failed.add(changed.id)

    if (!Notification.isSupported()) return

    const project = projects.list().find((one) => changed.project.startsWith(one.path))
    const notice = new Notification({
      title: `pnpm ${changed.script} failed`,
      body: `${project?.name ?? basename(changed.project)} · exit ${changed.exitCode ?? '?'}`,
    })

    notice.on('click', () => showWindow(project?.path))
    notice.show()
  })
}

app.whenReady().then(() => {
  watchApps()
  if (process.platform === 'darwin') held.push(createTray({ apps, projects, show: showWindow }))
  register({
    apps,
    projects,
    cli: cliPath,
    cliStatus,
    cliUpdate,
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

// Quitting stops every app, killing whole process trees: leaving Vite, Fastify or Metro behind would
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
