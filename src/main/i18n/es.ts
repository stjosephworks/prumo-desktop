// What the main process shows outside the window, in Latin American Spanish (es-419), shaped by en.ts. Menu items
// carry the names macOS and Windows give them in Spanish.
import type { MainDictionary } from './en.ts'

export const es: MainDictionary = {
  tray: {
    tooltip: 'Prumo Desktop',
    tooltipRunning: (count) => `Prumo Desktop · ${count} en ejecución`,
    nothingRunning: 'Nada en ejecución',
    running: (count) => `${count} en ejecución`,
    project: (name, count) => `${name}  ·  ${count} en ejecución`,
    openProject: 'Abrir proyecto',
    stopAll: 'Detener todas',
    show: 'Mostrar Prumo Desktop',
    quit: 'Salir',
  },
  notifications: {
    failed: (script) => `pnpm ${script} falló`,
    failedBody: (project, code) => `${project} · salida ${code}`,
    stillRunning: 'Prumo Desktop sigue abierto',
    stillRunningBody: (count) =>
      `${count === 1 ? '1 app sigue' : `${count} apps siguen`} en ejecución. ` +
      'Vuelve a abrir Prumo Desktop para detenerlas, o ciérralo desde su ícono en la bandeja del sistema.',
  },
  dialogs: {
    running: (count) =>
      count === 1 ? '1 app está en ejecución' : `${count} apps están en ejecución`,
    quittingStops: 'Al salir de Prumo Desktop, se detienen.',
    cancel: 'Cancelar',
    quitAndStop: 'Salir y detener',
    chooseNode: 'Elige el ejecutable de node',
    chooseProject: 'Elige una carpeta que contenga un .prumo/config.json',
    chooseParent: 'Elige dónde va la carpeta del nuevo proyecto',
  },
  cli: {
    nothingToUpdate: 'No hay nada a qué actualizar.',
  },
  menu: {
    about: (app) => `Acerca de ${app}`,
    services: 'Servicios',
    hide: (app) => `Ocultar ${app}`,
    hideOthers: 'Ocultar otros',
    showAll: 'Mostrar todo',
    quitApp: (app) => `Salir de ${app}`,
    file: 'Archivo',
    closeWindow: 'Cerrar ventana',
    exit: () => 'Salir',
    edit: (platform) => (platform === 'darwin' ? 'Edición' : 'Editar'),
    undo: 'Deshacer',
    redo: 'Rehacer',
    cut: 'Cortar',
    copy: 'Copiar',
    paste: 'Pegar',
    pasteAndMatchStyle: 'Pegar con el mismo estilo',
    delete: 'Eliminar',
    selectAll: 'Seleccionar todo',
    view: (platform) => (platform === 'darwin' ? 'Visualización' : 'Ver'),
    reload: 'Volver a cargar',
    forceReload: 'Forzar recarga',
    toggleDevTools: 'Herramientas para desarrolladores',
    resetZoom: 'Tamaño real',
    zoomIn: 'Ampliar',
    zoomOut: 'Reducir',
    toggleFullScreen: 'Usar pantalla completa',
    window: 'Ventana',
    minimize: 'Minimizar',
    zoom: 'Zoom',
    front: 'Traer todo al frente',
    close: 'Cerrar',
  },
}
