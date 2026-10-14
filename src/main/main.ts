// The Electron side: the window, the IPC handlers, and the promise that nothing the Desktop started outlives it.
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog, Notification } from 'electron'
import { UpdateSourceType, updateElectronApp } from 'update-electron-app'
import { type AppUpdate, CHANNELS, type CliStatus, type RunningApp } from '../shared/ipc.ts'
import { listReleases, newestRelease } from './app-update.ts'
import { doctor } from './cli.ts'
import { activeCli, installCli, publishedVersions, statusOf } from './cli-update.ts'
import { applyShellPath, chooseNode, findNode, nodeAt } from './environment.ts'
import { register } from './ipc.ts'
import { Apps } from './processes.ts'
import { Projects } from './projects.ts'
import { Settings } from './settings.ts'
import { createTray } from './tray.ts'
import { type Build, noticeEnabled, signedBuild, updaterEnabled } from './updates.ts'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string
/** Baked in by vite.main.config.mjs from build/signing.cjs: whether this build is signed with a Developer ID. */
declare const DEVELOPER_ID_BUILD: boolean

// Forge builds the main process as CommonJS, where `import.meta.dirname` is undefined: use `__dirname`.
const here = __dirname

// Before anything else: opened from Finder, the app would not even see the user's Node.
void applyShellPath()

const mac = process.platform === 'darwin'

// One Desktop at a time: opening it again brings the running one forward. Off macOS that is how a user gets back to
// a Desktop that kept running with its window closed, where the tray icon may not show (GNOME without an
// AppIndicator extension).
const primary = app.requestSingleInstanceLock()
if (!primary) app.quit()

const apps = new Apps()
// The list of projects the user keeps, beside the app's own data: nothing of it belongs in a project.
const projects = new Projects(join(app.getPath('userData'), 'projects.json'))
// The node executable the user picked, when this machine's PATH has none: used before the PATH from then on.
const settings = new Settings(join(app.getPath('userData'), 'settings.json'))
chooseNode(settings.read().node)

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

/** The PNG icon, beside the embedded CLI once packaged (forge.config.js), in build/ during development. */
function pngIcon(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'build', 'icon.png')
}

/**
 * Off macOS a hidden title bar takes the window's controls with it, and `titleBarOverlay` draws them back over the
 * top right corner. Its height is the strip above the content (`h-10` in src/renderer/router.tsx), and its colours
 * are the paper and ink of src/renderer/index.css, so the controls sit on the strip as the traffic lights do.
 */
const TITLE_BAR_OVERLAY = { color: '#f1f4f7', symbolColor: '#112439', height: 40 }

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    ...(mac
      ? { titleBarStyle: 'hiddenInset' as const }
      : { titleBarStyle: 'hidden' as const, titleBarOverlay: TITLE_BAR_OVERLAY }),
    // Linux shows it in the window switcher and the dock; macOS and Windows take theirs from the bundle and the exe.
    ...(process.platform === 'linux' ? { icon: pngIcon() } : {}),
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

function runningApps(): RunningApp[] {
  return apps.list().filter((one) => one.state === 'running' || one.state === 'starting')
}

/**
 * What happens outside the window: the Dock badge counts what runs, and a process that fails while the window is
 * in the background says so in a notification, which brings the window back on that project when clicked.
 * Off macOS, a Desktop kept alive with its window closed quits once the last app has stopped.
 */
function watchApps(): void {
  const failed = new Set<string>()

  apps.on('state', (changed: RunningApp) => {
    const running = runningApps()
    app.setBadgeCount(running.length)

    if (!mac && running.length === 0 && BrowserWindow.getAllWindows().length === 0) {
      app.quit()
      return
    }

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

const build: Build = {
  packaged: app.isPackaged,
  platform: process.platform,
  developerId: DEVELOPER_ID_BUILD,
  windowsStore: process.windowsStore,
}

// A packaged macOS app signed with a Developer ID updates itself from GitHub Releases through update.electronjs.org:
// it checks at launch and every ten minutes, then asks to restart. Every other build gets the notice below instead
// (src/main/updates.ts).
if (primary && updaterEnabled(build)) {
  updateElectronApp({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: 'stjosephworks/prumo-desktop',
    },
  })
}

/** The newer Desktop the last check found, which the window asks for when it opens. */
let appUpdate: AppUpdate | undefined

/** Six hours: often enough for a preview that ships often, and far below GitHub's unauthenticated rate limit. */
const UPDATE_CHECK_EVERY_MS = 6 * 60 * 60 * 1000

/**
 * Asks GitHub Releases for a newer Desktop: pre-releases too on an unsigned build, which is one itself. A failed
 * check says nothing; the next one tries again.
 */
async function checkForAppUpdate(): Promise<void> {
  try {
    const found = newestRelease(await listReleases(), app.getVersion(), !signedBuild(build))

    if (found === undefined || found.version === appUpdate?.version) return

    appUpdate = found
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(CHANNELS.appUpdateFound, found)
    }
  } catch {
    // Offline, or GitHub refused: the notice simply does not appear.
  }
}

app.on('second-instance', () => showWindow())

app.whenReady().then(() => {
  if (!primary) return

  watchApps()
  held.push(createTray({ apps, projects, show: showWindow, icon: pngIcon() }))

  if (noticeEnabled(build, process.env)) {
    void checkForAppUpdate()
    setInterval(checkForAppUpdate, UPDATE_CHECK_EVERY_MS)
  }

  register({
    appUpdate: () => appUpdate,
    apps,
    projects,
    cli: cliPath,
    cliStatus,
    cliUpdate,
    windows: () => BrowserWindow.getAllWindows(),
    keepNode: async (path) => {
      if ((await nodeAt(path)) === undefined) return false
      settings.write({ node: path })
      chooseNode(path)
      return true
    },
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

  const running = runningApps()

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

/**
 * Closing the window off macOS quits the Desktop, unless apps run: then it keeps them running and says so, since
 * the tray icon that can quit it is not shown everywhere. macOS keeps the app in the Dock, as its apps do.
 */
app.on('window-all-closed', () => {
  if (mac) return

  const running = runningApps()

  if (running.length === 0) {
    app.quit()
    return
  }

  if (!Notification.isSupported()) return

  const notice = new Notification({
    title: 'Prumo Desktop is still running',
    body:
      `${running.length === 1 ? '1 app keeps' : `${running.length} apps keep`} running. ` +
      'Open Prumo Desktop again to stop them, or quit it from its icon in the system tray.',
  })
  notice.on('click', () => showWindow())
  notice.show()
})
