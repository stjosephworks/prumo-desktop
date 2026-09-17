// The IPC contract. Imported by main, preload and renderer, so a change breaks both sides at compile time.

/** A `prumo doctor` check, as the CLI reports it. */
export type Check = {
  id: string
  label: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
  required: boolean
}

/** What the Desktop knows about this machine: the Node it found, and what the CLI says about the rest. */
export type Environment =
  | { ready: boolean; node: { path: string; version: string }; checks: Check[] }
  // Without Node nothing runs, `prumo doctor` included, so there are no checks to show.
  | { ready: false; node: undefined; checks: [] }

/** What `.prumo/config.json` holds. The Desktop reads it; only the CLI writes it. */
export type ProjectConfig = {
  types: ('api' | 'web' | 'mobile' | 'site')[]
  architecture: 'alone' | 'monorepo'
  multiTenant: boolean
}

/** A project in the list. `found` is false when the folder, or its `.prumo/config.json`, is gone. */
export type Project = {
  path: string
  name: string
  found: boolean
  config?: ProjectConfig
}

/** The answers `prumo new` needs. Every question the CLI asks has a flag, and the Desktop fills them all. */
export type NewProject = {
  /** The folder the project is created inside; the CLI creates `<parent>/<name>`. */
  parent: string
  name: string
  types: ProjectConfig['types']
  architecture: ProjectConfig['architecture']
  multiTenant: boolean
}

/**
 * A failed creation carries the CLI's own error code, which the Desktop branches on:
 * `invalid_input` belongs beside the name, `target_not_empty` beside the folder.
 */
export type CreateResult =
  | { ok: true; project: Project }
  | { ok: false; code: string; message: string }

/** Whether the project has a database to create, and whether it already has one. */
export type DatabaseState =
  | { part: false }
  | { part: true; created: boolean; error?: { code: string; message: string } }

/** What Docker says about the project's own compose service. `missing` and `stopped` are told apart. */
export type DockerState =
  | { part: false }
  | {
      part: true
      docker: 'missing' | 'stopped' | 'running'
      services: { name: string; state: string }[]
    }

/** State of one app started by the Desktop. `failed` means it exited on its own with an error. */
export type AppState = 'starting' | 'running' | 'stopped' | 'failed'

export type RunningApp = {
  /** `<project path>#<script>`: an app is one script of one project. */
  id: string
  project: string
  script: string
  state: AppState
  exitCode?: number
}

export type StartApp = { project: string; script: string; cols?: number; rows?: number }

/** What the preload bridge exposes on `window.prumo`. The renderer has nothing else. */
export type Bridge = {
  environment: () => Promise<Environment>
  /** Opens an `http` or `https` address in the user's browser. Nothing else is opened this way. */
  openExternal: (url: string) => Promise<void>
  projects: {
    list: () => Promise<Project[]>
    /** Opens the folder picker and adds what was chosen; undefined when the user cancelled. */
    add: () => Promise<Project | undefined>
    remove: (path: string) => Promise<void>
    /** Opens the project in Finder, the editor or a terminal. */
    reveal: (path: string) => Promise<void>
    /** Runs `prumo new`; the log arrives through `onCreateLog` while it runs. */
    create: (input: NewProject) => Promise<CreateResult>
    /** Opens the folder picker for where a new project goes. */
    chooseParent: () => Promise<string | undefined>
    onCreateLog: (listener: (chunk: string) => void) => () => void
  }
  docs: {
    /** Reads one document of a project's `.prumo/`; `INDEX.md` when none is given. */
    read: (
      project: string,
      document?: string,
    ) => Promise<{ ok: true; text: string } | { ok: false; message: string }>
    /** Opens the document in whatever the system uses for markdown, usually the editor. */
    openInEditor: (project: string, document: string) => Promise<void>
  }
  database: {
    state: (project: Project) => Promise<{ database: DatabaseState; docker: DockerState }>
    /** Runs `prumo db --name <name>`: it creates the database in Docker and migrates it. */
    create: (
      project: Project,
      name: string,
    ) => Promise<{ ok: true } | { ok: false; code: string; message: string }>
    startDocker: (project: Project) => Promise<boolean>
    stopDocker: (project: Project) => Promise<boolean>
    /** The log of `prumo db`, while it runs. */
    onLog: (listener: (chunk: string) => void) => () => void
  }
  apps: {
    list: () => Promise<RunningApp[]>
    start: (app: StartApp) => Promise<RunningApp>
    stop: (id: string) => Promise<RunningApp | undefined>
    /** Everything the app has written so far, to fill a terminal that was opened late. */
    buffer: (id: string) => Promise<string>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    onOutput: (listener: (id: string, data: string) => void) => () => void
    onState: (listener: (app: RunningApp) => void) => () => void
  }
}

export const CHANNELS = {
  environment: 'prumo:environment',
  projectsList: 'prumo:projects:list',
  projectsAdd: 'prumo:projects:add',
  projectsRemove: 'prumo:projects:remove',
  projectsReveal: 'prumo:projects:reveal',
  projectsCreate: 'prumo:projects:create',
  projectsChooseParent: 'prumo:projects:choose-parent',
  projectsCreateLog: 'prumo:projects:create-log',
  docsRead: 'prumo:docs:read',
  docsOpenInEditor: 'prumo:docs:open-in-editor',
  openExternal: 'prumo:open-external',
  databaseState: 'prumo:database:state',
  databaseCreate: 'prumo:database:create',
  databaseStart: 'prumo:database:start',
  databaseStop: 'prumo:database:stop',
  databaseLog: 'prumo:database:log',
  list: 'prumo:apps:list',
  start: 'prumo:apps:start',
  stop: 'prumo:apps:stop',
  buffer: 'prumo:apps:buffer',
  write: 'prumo:apps:write',
  resize: 'prumo:apps:resize',
  output: 'prumo:apps:output',
  state: 'prumo:apps:state',
} as const
