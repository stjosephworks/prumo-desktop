// Every word the main process shows outside the window, in English: the tray, the app menu, notifications and
// native dialogs. Every other dictionary is typed by this one, so a key missing there breaks the build.

export const en = {
  tray: {
    tooltip: 'Prumo Desktop',
    tooltipRunning: (count: number) => `Prumo Desktop · ${count} running`,
    nothingRunning: 'Nothing running',
    running: (count: number) => `${count} running`,
    project: (name: string, count: number) => `${name}  ·  ${count} running`,
    openProject: 'Open project',
    stopAll: 'Stop all',
    show: 'Show Prumo Desktop',
    quit: 'Quit',
  },
  notifications: {
    failed: (script: string) => `pnpm ${script} failed`,
    failedBody: (project: string, code: number | string) => `${project} · exit ${code}`,
    stillRunning: 'Prumo Desktop is still running',
    stillRunningBody: (count: number) =>
      `${count === 1 ? '1 app keeps' : `${count} apps keep`} running. ` +
      'Open Prumo Desktop again to stop them, or quit it from its icon in the system tray.',
  },
  dialogs: {
    running: (count: number) => (count === 1 ? '1 app is running' : `${count} apps are running`),
    quittingStops: 'Quitting Prumo Desktop stops them.',
    cancel: 'Cancel',
    quitAndStop: 'Quit and stop',
    chooseNode: 'Choose the node executable',
    chooseProject: 'Choose a folder that holds a .prumo/config.json',
    chooseParent: 'Choose where the new project folder goes',
  },
  cli: {
    nothingToUpdate: 'There is nothing to update to.',
  },
  /** The application menu, by the names each system gives its standard items. */
  menu: {
    about: (app: string) => `About ${app}`,
    services: 'Services',
    hide: (app: string) => `Hide ${app}`,
    hideOthers: 'Hide Others',
    showAll: 'Show All',
    quitApp: (app: string) => `Quit ${app}`,
    file: 'File',
    closeWindow: 'Close Window',
    /** Windows calls quitting an app Exit; Linux, Quit. */
    exit: (platform: string): string => (platform === 'win32' ? 'Exit' : 'Quit'),
    /** macOS and Windows name some menus differently in other languages, so these take the platform. */
    edit: (_platform: string) => 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    pasteAndMatchStyle: 'Paste and Match Style',
    delete: 'Delete',
    selectAll: 'Select All',
    view: (_platform: string) => 'View',
    reload: 'Reload',
    forceReload: 'Force Reload',
    toggleDevTools: 'Toggle Developer Tools',
    resetZoom: 'Actual Size',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    toggleFullScreen: 'Toggle Full Screen',
    window: 'Window',
    minimize: 'Minimize',
    zoom: 'Zoom',
    front: 'Bring All to Front',
    close: 'Close',
  },
}

export type MainDictionary = typeof en
