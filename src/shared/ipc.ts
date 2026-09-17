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
  list: 'prumo:apps:list',
  start: 'prumo:apps:start',
  stop: 'prumo:apps:stop',
  buffer: 'prumo:apps:buffer',
  write: 'prumo:apps:write',
  resize: 'prumo:apps:resize',
  output: 'prumo:apps:output',
  state: 'prumo:apps:state',
} as const
