// The IPC contract. Imported by main, preload and renderer, so a change breaks both sides at compile time.
import type { Locale, LocaleState } from './locales.ts'

/** A `prumo doctor` check, as the CLI reports it. */
export type Check = {
  id: string
  label: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
  required: boolean
}

/** What the Desktop knows about this machine: the Node it found, and what the CLI says about the rest. */
export type Environment = (
  | { ready: boolean; node: { path: string; version: string }; checks: Check[] }
  // Without Node nothing runs, `prumo doctor` included, so there are no checks to show.
  | { ready: false; node: undefined; checks: [] }
) & {
  /** Windows only: why the PATH could not be read from the registry, which explains a tool reported missing. */
  pathProblem?: string
}

/** What `.prumo/config.json` holds. The Desktop reads it; only the CLI writes it. */
export type ProjectConfig = {
  /** The Prumo version that generated the project; written since 0.1.1, so absent from an older project. */
  prumo?: string
  types: ('api' | 'web' | 'mobile' | 'site')[]
  architecture: 'alone' | 'monorepo'
  multiTenant: boolean
  /** An MCP server on the api. A project from a CLI older than 0.1.0 has no such field, and is read as false. */
  mcp: boolean
  /** Email verification and password reset. Written since 0.4.0; an older project is read as false. */
  email: boolean
  /** The social sign-in providers. Written since 0.4.0; an older project is read as none. */
  social: SocialProvider[]
}

/** The providers `prumo new --social` accepts. */
export type SocialProvider = 'google' | 'apple'

/**
 * The Prumo CLI the Desktop runs. `shipped` is the copy inside the app; `updated` is a newer one of the same
 * minor, installed beside the app's data. `available` is the newest the Desktop can update to; `needsDesktop`
 * is a newer minor, which only a newer Desktop runs. Both are undefined when the registry could not be asked.
 */
export type CliStatus = {
  version: string
  source: 'shipped' | 'updated'
  available?: string
  needsDesktop?: string
  error?: string
}

/** The editors and terminals found on this machine, by their app names; empty where the Desktop cannot open one. */
export type Openers = { editors: string[]; terminals: string[] }

/** A project's Git state: its branch (undefined when detached) and how many paths have changes. */
export type GitState = { branch?: string; changes: number }

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
  /** Only asked, and only passed, when the types hold both api and web. */
  mcp: boolean
  /** Only asked, and only passed, when the types hold api. */
  email: boolean
  /** Only asked, and only passed, when the types hold api and a web or mobile app; empty means none. */
  social: SocialProvider[]
}

/**
 * A failed creation carries the CLI's own error code, which the Desktop branches on:
 * `invalid_input` belongs beside the name, `target_not_empty` beside the folder. The CLI also answers
 * `invalid_input` for a combination of flags, but the form never sends one (`src/shared/questions.ts`), so what
 * reaches it is about the name.
 * A created project carries the CLI's `warnings`: consequences of the answers it did not refuse, in its words.
 */
export type CreateResult =
  | { ok: true; project: Project; warnings: string[] }
  | { ok: false; code: string; message: string }

/** Whether the project has a database to create, and whether it already has one. */
export type DatabaseState =
  | { part: false }
  | { part: true; created: boolean; error?: { code: string; message: string } }

/**
 * What `prumo db --name` answers. `created` is false when the database already existed; the codes the Desktop
 * branches on are `docker_missing` and `docker_not_running`.
 */
export type DatabaseCreated =
  | { ok: true; database: string; port: number; created: boolean; migrated: boolean }
  | { ok: false; code: string; message: string }

/** What Docker says about the project's own compose service. `missing` and `stopped` are told apart. */
export type DockerState =
  | { part: false }
  | {
      part: true
      docker: 'missing' | 'stopped' | 'running'
      /** `port` is the host port Docker publishes, known only while the service runs. */
      services: { name: string; state: string; port?: number }[]
    }

/**
 * What opening Docker came to: its engine answers, it was started and never answered, or this system has no
 * Docker the Desktop can start, and the user has to start it.
 */
export type OpenDocker = 'running' | 'failed' | 'manual'

/** State of one app started by the Desktop. `failed` means it exited on its own with an error. */
export type AppState = 'starting' | 'running' | 'stopped' | 'failed'

export type RunningApp = {
  /** `<project path>#<script>`: an app is one script of one project. */
  id: string
  project: string
  script: string
  state: AppState
  exitCode?: number
  /** The port its check settled before it started, when there was one: where an API's health is asked. */
  port?: number
}

export type StartApp = {
  project: string
  script: string
  cols?: number
  rows?: number
  port?: number
}

/**
 * Whether an app's port is free, from the app's own `scripts/ports.mjs --check`. `port_busy` carries the
 * script's message, which names what holds the port; `kill` stops that, `change` moves the app to a free port.
 */
export type PortCheck = { ok: true; port?: number } | { ok: false; code: string; message: string }

/**
 * What an API's `/api/health/ready` answers: `ready` (200), `database_down` (503, the server runs but cannot
 * reach its database) or `unreachable` (nothing answers on the port).
 */
export type ApiHealth = 'ready' | 'database_down' | 'unreachable'
export type PortAnswer = 'kill' | 'change'

/** What the preload bridge exposes on `window.prumo`. The renderer has nothing else. */
/** A newer Prumo Desktop on GitHub Releases, and the page the notice opens for it. */
export type AppUpdate = { version: string; url: string }

export type Bridge = {
  /** `process.platform`, which names the file manager and lays out the window's title bar. */
  platform: string
  environment: () => Promise<Environment>
  /**
   * Lets the user pick the node executable by hand, when no PATH and no usual folder has one. It is kept for the
   * next launch, and the new report comes back; a file that does not run as Node is refused.
   */
  chooseNode: () => Promise<
    { ok: true; environment: Environment } | { ok: false; reason: 'canceled' | 'not_node' }
  >
  /** The main process asking to show a project, as when a notification about it is clicked. */
  onNavigate: (listener: (project: string) => void) => () => void
  /** Puts text on the system clipboard, through the main process, whether or not the window has focus. */
  copy: (text: string) => Promise<void>
  /** Opens an `http` or `https` address in the user's browser. Nothing else is opened this way. */
  openExternal: (url: string) => Promise<void>
  /**
   * The language the Desktop speaks, which the main process owns: it is kept in the app's settings, and the tray,
   * the menu and notifications follow it too.
   */
  locale: {
    /** The language in use, and whether the user chose it (otherwise it is the system's). */
    get: () => Promise<LocaleState>
    /** Keeps the user's choice and switches every surface to it; undefined forgets it and follows the system. */
    set: (locale: Locale | undefined) => Promise<LocaleState>
    /** Called when the language changes, from this window or another. */
    onChange: (listener: (state: LocaleState) => void) => () => void
  }
  app: {
    /** A newer Desktop, when the notice is on for this build and GitHub has one (src/main/updates.ts). */
    update: () => Promise<AppUpdate | undefined>
    /** Called when a check finds a newer Desktop than the last one it found. */
    onUpdate: (listener: (update: AppUpdate) => void) => () => void
  }
  cli: {
    /** The CLI in use, and what the npm registry has that is newer. */
    status: () => Promise<CliStatus>
    /** Installs `available` and switches to it; the new status on success. */
    update: () => Promise<{ ok: true; status: CliStatus } | { ok: false; message: string }>
  }
  projects: {
    list: () => Promise<Project[]>
    /** Opens the folder picker and adds what was chosen; undefined when the user cancelled. */
    add: () => Promise<Project | undefined>
    remove: (path: string) => Promise<void>
    /** Opens the project's folder in the system's file manager. */
    reveal: (path: string) => Promise<void>
    /** The project's branch and uncommitted changes; undefined when it is not a Git repository. */
    git: (path: string) => Promise<GitState | undefined>
    /** The editors and terminals the project can be opened in. */
    openers: () => Promise<Openers>
    /** Opens the project in one of `openers()`; false when that app is unknown or would not open. */
    openIn: (app: string, path: string) => Promise<boolean>
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
    create: (project: Project, name: string) => Promise<DatabaseCreated>
    startDocker: (project: Project) => Promise<boolean>
    stopDocker: (project: Project) => Promise<boolean>
    /** Opens Docker Desktop and resolves once its engine answers, or says why it could not. */
    openDocker: () => Promise<OpenDocker>
    /** The log of `prumo db`, while it runs. */
    onLog: (listener: (chunk: string) => void) => () => void
  }
  apps: {
    list: () => Promise<RunningApp[]>
    /** Frees the part's port before it starts; without an answer it only reports who holds it. */
    checkPort: (
      project: Project,
      type: ProjectConfig['types'][number],
      answer?: PortAnswer,
    ) => Promise<PortCheck>
    /** Asks a running API, on the port its check settled, whether it is ready. */
    health: (port: number) => Promise<ApiHealth>
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
  chooseNode: 'prumo:environment:choose-node',
  localeGet: 'prumo:locale:get',
  localeSet: 'prumo:locale:set',
  localeChanged: 'prumo:locale:changed',
  appUpdate: 'prumo:app:update',
  appUpdateFound: 'prumo:app:update-found',
  cliStatus: 'prumo:cli:status',
  cliUpdate: 'prumo:cli:update',
  projectsList: 'prumo:projects:list',
  projectsAdd: 'prumo:projects:add',
  projectsRemove: 'prumo:projects:remove',
  projectsReveal: 'prumo:projects:reveal',
  projectsOpeners: 'prumo:projects:openers',
  projectsGit: 'prumo:projects:git',
  projectsOpenIn: 'prumo:projects:open-in',
  projectsCreate: 'prumo:projects:create',
  projectsChooseParent: 'prumo:projects:choose-parent',
  projectsCreateLog: 'prumo:projects:create-log',
  docsRead: 'prumo:docs:read',
  docsOpenInEditor: 'prumo:docs:open-in-editor',
  openExternal: 'prumo:open-external',
  copy: 'prumo:copy',
  navigate: 'prumo:navigate',
  databaseState: 'prumo:database:state',
  databaseCreate: 'prumo:database:create',
  databaseStart: 'prumo:database:start',
  databaseStop: 'prumo:database:stop',
  databaseOpenDocker: 'prumo:database:open-docker',
  databaseLog: 'prumo:database:log',
  list: 'prumo:apps:list',
  checkPort: 'prumo:apps:check-port',
  health: 'prumo:apps:health',
  start: 'prumo:apps:start',
  stop: 'prumo:apps:stop',
  buffer: 'prumo:apps:buffer',
  write: 'prumo:apps:write',
  resize: 'prumo:apps:resize',
  output: 'prumo:apps:output',
  state: 'prumo:apps:state',
} as const
