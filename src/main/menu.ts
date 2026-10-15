// The application menu, in the language in use. It holds what Electron's default menu holds (its roles, so every
// item keeps its native behaviour and shortcut), only with labels of its own: a role's default label is English.
// Items macOS adds by itself, such as Start Dictation or the Window menu's list of windows, are named by macOS.
import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import type { MainDictionary } from './i18n/en.ts'

function template(words: MainDictionary, platform: string): MenuItemConstructorOptions[] {
  const m = words.menu
  const name = app.name
  const mac = platform === 'darwin'
  const separator = { type: 'separator' } as const

  const edit: MenuItemConstructorOptions = {
    label: m.edit(platform),
    submenu: [
      { role: 'undo', label: m.undo },
      { role: 'redo', label: m.redo },
      separator,
      { role: 'cut', label: m.cut },
      { role: 'copy', label: m.copy },
      { role: 'paste', label: m.paste },
      ...(mac ? [{ role: 'pasteAndMatchStyle' as const, label: m.pasteAndMatchStyle }] : []),
      { role: 'delete', label: m.delete },
      separator,
      { role: 'selectAll', label: m.selectAll },
    ],
  }

  const view: MenuItemConstructorOptions = {
    label: m.view(platform),
    submenu: [
      { role: 'reload', label: m.reload },
      { role: 'forceReload', label: m.forceReload },
      { role: 'toggleDevTools', label: m.toggleDevTools },
      separator,
      { role: 'resetZoom', label: m.resetZoom },
      { role: 'zoomIn', label: m.zoomIn },
      { role: 'zoomOut', label: m.zoomOut },
      separator,
      { role: 'togglefullscreen', label: m.toggleFullScreen },
    ],
  }

  if (!mac) {
    return [
      { label: m.file, submenu: [{ role: 'quit', label: m.exit(platform) }] },
      edit,
      view,
      {
        label: m.window,
        submenu: [
          { role: 'minimize', label: m.minimize },
          { role: 'close', label: m.close },
        ],
      },
    ]
  }

  return [
    {
      label: name,
      submenu: [
        { role: 'about', label: m.about(name) },
        separator,
        { role: 'services', label: m.services },
        separator,
        { role: 'hide', label: m.hide(name) },
        { role: 'hideOthers', label: m.hideOthers },
        { role: 'unhide', label: m.showAll },
        separator,
        { role: 'quit', label: m.quitApp(name) },
      ],
    },
    { label: m.file, submenu: [{ role: 'close', label: m.closeWindow }] },
    edit,
    view,
    {
      // The window role makes it macOS's Window menu, to which macOS appends its own items, such as open windows.
      role: 'window',
      label: m.window,
      submenu: [
        { role: 'minimize', label: m.minimize },
        { role: 'zoom', label: m.zoom },
        separator,
        { role: 'front', label: m.front },
      ],
    },
  ]
}

/** Sets the application menu in the language given; called at launch and on every change of language. */
export function applyMenu(words: MainDictionary): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template(words, process.platform)))
}
