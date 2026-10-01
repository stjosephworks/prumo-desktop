// The menu bar's plumb bob: every project's apps, started and stopped without opening the window, and how many
// run, beside the icon. Starting goes through the same port check as the project screen; a port in use opens the
// window on that project instead, where the question has its buttons.
import { Menu, type MenuItemConstructorOptions, nativeImage, Tray } from 'electron'
import { partId, partsFor } from '../shared/parts.ts'
import { checkPort } from './ports.ts'
import type { Apps } from './processes.ts'
import type { Projects } from './projects.ts'
import { plumbPng } from './tray-icon.ts'

type Wiring = {
  apps: Apps
  projects: Projects
  /** Brings the window forward, on a project when one is given. */
  show: (project?: string) => void
}

export function createTray({ apps, projects, show }: Wiring): Tray {
  // Drawn at twice the menu bar's 18 points, marked as a template so macOS inverts it in dark menus.
  const { png } = plumbPng(36)
  const icon = nativeImage.createFromBuffer(png, { scaleFactor: 2 })
  icon.setTemplateImage(true)

  const tray = new Tray(icon)
  tray.setToolTip('Prumo Desktop')

  const isRunning = (id: string) => {
    const state = apps.get(id)?.state
    return state === 'running' || state === 'starting'
  }

  const rebuild = () => {
    const running = apps.list().filter((one) => one.state === 'running' || one.state === 'starting')
    tray.setTitle(running.length > 0 ? String(running.length) : '', { fontType: 'monospacedDigit' })

    const projectItems: MenuItemConstructorOptions[] = projects
      .list()
      .filter((project) => project.found)
      .map((project) => {
        const parts = partsFor(project)
        const busy = parts.filter((part) => isRunning(partId(project, part))).length

        return {
          label: busy > 0 ? `${project.name}  ·  ${busy} running` : project.name,
          submenu: [
            ...parts.map(
              (part): MenuItemConstructorOptions => ({
                label: part.type,
                type: 'checkbox',
                checked: isRunning(partId(project, part)),
                click: async () => {
                  const id = partId(project, part)
                  if (isRunning(id)) {
                    await apps.stop(id)
                    return
                  }
                  const check = await checkPort(project, part.type)
                  if (!check.ok) {
                    show(project.path)
                    return
                  }
                  apps.start({ project: project.path, script: part.script, port: check.port })
                },
              }),
            ),
            { type: 'separator' },
            { label: 'Open project', click: () => show(project.path) },
          ],
        }
      })

    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: running.length === 0 ? 'Nothing running' : `${running.length} running`,
          enabled: false,
        },
        { type: 'separator' },
        ...projectItems,
        ...(projectItems.length > 0 ? [{ type: 'separator' as const }] : []),
        { label: 'Stop all', enabled: running.length > 0, click: () => void apps.stopAll() },
        { label: 'Show Prumo Desktop', click: () => show() },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' },
      ]),
    )
  }

  apps.on('state', rebuild)
  // Projects are added and removed in the window; the menu catches up without listening to every screen.
  setInterval(rebuild, 5_000)
  rebuild()

  return tray
}
