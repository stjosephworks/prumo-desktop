// The menu bar's plumb bob, and the system tray's icon on Windows and Linux: every project's apps, started and
// stopped without opening the window, and how many run, beside the icon on macOS and in its tooltip elsewhere. Starting goes through the same port check as the project screen; a port in use opens the
// window on that project instead, where the question has its buttons.
import { Menu, type MenuItemConstructorOptions, nativeImage, Tray } from 'electron'
import { partId, partsFor } from '../shared/parts.ts'
import { applyShellPath } from './environment.ts'
import type { MainDictionary } from './i18n/en.ts'
import { checkPort } from './ports.ts'
import type { Apps } from './processes.ts'
import type { Projects } from './projects.ts'
import { plumbPng } from './tray-icon.ts'

type Wiring = {
  apps: Apps
  projects: Projects
  /** Brings the window forward, on a project when one is given. */
  show: (project?: string) => void
  /** The app's PNG icon, which the tray shows outside macOS. */
  icon: string
  /** The words of the language in use, read on every rebuild. */
  words: () => MainDictionary
}

const mac = process.platform === 'darwin'

/**
 * macOS draws a template image, black and alpha, which it inverts in dark menus. Windows and Linux show colours as
 * they are, so the app's own icon, at the 16 points both trays use (Electron's tray guide), drawn at twice that.
 */
function trayIcon(icon: string) {
  if (mac) {
    // Drawn at twice the menu bar's 18 points, marked as a template so macOS inverts it in dark menus.
    const { png } = plumbPng(36)
    const image = nativeImage.createFromBuffer(png, { scaleFactor: 2 })
    image.setTemplateImage(true)
    return image
  }

  return nativeImage.createFromPath(icon).resize({ width: 32, height: 32, quality: 'best' })
}

/** The tray, and `rebuild`, which redraws its menu and tooltip: after a change of language, for one. */
export function createTray({ apps, projects, show, icon, words }: Wiring): {
  tray: Tray
  rebuild: () => void
} {
  const tray = new Tray(trayIcon(icon))
  tray.setToolTip(words().tray.tooltip)
  // Windows opens a tray icon's menu on a right click only; a left click opens it too, as it does on macOS.
  if (process.platform === 'win32') tray.on('click', () => tray.popUpContextMenu())

  const isRunning = (id: string) => {
    const state = apps.get(id)?.state
    return state === 'running' || state === 'starting'
  }

  const rebuild = () => {
    const t = words().tray
    const running = apps.list().filter((one) => one.state === 'running' || one.state === 'starting')
    // Only macOS has a title beside the icon; elsewhere the count is in the tooltip.
    if (mac) {
      tray.setTitle(running.length > 0 ? String(running.length) : '', {
        fontType: 'monospacedDigit',
      })
    } else {
      tray.setToolTip(running.length > 0 ? t.tooltipRunning(running.length) : t.tooltip)
    }

    const projectItems: MenuItemConstructorOptions[] = projects
      .list()
      .filter((project) => project.found)
      .map((project) => {
        const parts = partsFor(project)
        const busy = parts.filter((part) => isRunning(partId(project, part))).length

        return {
          label: busy > 0 ? t.project(project.name, busy) : project.name,
          submenu: [
            ...parts.map(
              (part): MenuItemConstructorOptions => ({
                label: part.name,
                type: 'checkbox',
                checked: isRunning(partId(project, part)),
                click: async () => {
                  await applyShellPath()
                  const id = partId(project, part)
                  if (isRunning(id)) {
                    await apps.stop(id)
                    return
                  }
                  const check = await checkPort(project, part.name)
                  if (!check.ok) {
                    show(project.path)
                    return
                  }
                  apps.start({ project: project.path, script: part.script, port: check.port })
                },
              }),
            ),
            { type: 'separator' },
            { label: t.openProject, click: () => show(project.path) },
          ],
        }
      })

    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: running.length === 0 ? t.nothingRunning : t.running(running.length),
          enabled: false,
        },
        { type: 'separator' },
        ...projectItems,
        ...(projectItems.length > 0 ? [{ type: 'separator' as const }] : []),
        { label: t.stopAll, enabled: running.length > 0, click: () => void apps.stopAll() },
        { label: t.show, click: () => show() },
        { type: 'separator' },
        { label: t.quit, role: 'quit' },
      ]),
    )
  }

  apps.on('state', rebuild)
  // Projects are added and removed in the window; the menu catches up without listening to every screen.
  setInterval(rebuild, 5_000)
  rebuild()

  return { tray, rebuild }
}
