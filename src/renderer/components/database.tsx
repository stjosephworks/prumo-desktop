import { useCallback, useEffect, useState } from 'react'
import type { DatabaseState, DockerState, Project } from '../../shared/ipc.ts'
import { apiDirectory } from '../../shared/parts.ts'
import { Terminal } from './terminal.tsx'

const DOCKER_MESSAGE = {
  missing: 'Docker is not installed, and the database runs in it.',
  stopped: 'Docker is installed but not running. Open Docker Desktop and try again.',
  running: '',
} as const

/** The database part of a project: created through `prumo db`, run by Docker, migrated on request. */
export function Database({ project }: { project: Project }) {
  const [state, setState] = useState<{ database: DatabaseState; docker: DockerState }>()
  const [name, setName] = useState(project.name.replaceAll('-', '_'))
  const [working, setWorking] = useState<string>()
  const [error, setError] = useState<string>()
  const [log, setLog] = useState('')

  const api = apiDirectory(project)
  const migrationId = api === undefined ? undefined : `${api}#db:migrate`

  const refresh = useCallback(() => {
    window.prumo.database.state(project).then(setState)
  }, [project])

  useEffect(refresh, [refresh])
  useEffect(() => window.prumo.database.onLog((chunk) => setLog((all) => all + chunk)), [])

  if (state === undefined || !state.database.part) return null

  const docker = state.docker
  const containerRunning =
    docker.part &&
    docker.docker === 'running' &&
    docker.services.some((one) => one.state === 'running')

  const act = async (label: string, action: () => Promise<unknown>) => {
    setWorking(label)
    setError(undefined)
    await action()
    setWorking(undefined)
    refresh()
  }

  return (
    <section className="mt-8 rounded-md border border-neutral-200 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`size-2 rounded-full ${containerRunning ? 'bg-emerald-500' : 'bg-neutral-300'}`}
          />
          <span className="font-medium">database</span>
          <span className="text-xs text-neutral-500">
            {state.database.created ? 'created' : 'not created yet'}
            {docker.part &&
              docker.docker === 'running' &&
              ` — Docker ${containerRunning ? 'up' : 'down'}`}
          </span>
        </div>

        {state.database.created && docker.part && docker.docker === 'running' && (
          <div className="flex gap-3">
            <button
              type="button"
              disabled={working !== undefined}
              onClick={() =>
                act('docker', () =>
                  containerRunning
                    ? window.prumo.database.stopDocker(project)
                    : window.prumo.database.startDocker(project),
                )
              }
              className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 disabled:opacity-40"
            >
              {containerRunning ? 'Stop' : 'Start'}
            </button>
            {/* Migrations never run by themselves: they are asked for, and their output is a terminal like any other. */}
            <button
              type="button"
              onClick={() =>
                api !== undefined && window.prumo.apps.start({ project: api, script: 'db:migrate' })
              }
              className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
            >
              Migrate
            </button>
          </div>
        )}
      </div>

      {docker.part && docker.docker !== 'running' && (
        <p className="mt-3 text-sm text-amber-700">{DOCKER_MESSAGE[docker.docker]}</p>
      )}

      {!state.database.created && (
        <div className="mt-4">
          <p className="text-sm text-neutral-500">
            The API starts with <code>DATABASE_URL=MISSING</code>. Creating the database writes its
            URL and runs the migrations.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Database name"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={working !== undefined || name === ''}
              onClick={() =>
                act('create', async () => {
                  setLog('')
                  const result = await window.prumo.database.create(project, name)
                  if (!result.ok) setError(result.message)
                })
              }
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-40"
            >
              {working === 'create' ? 'Creating…' : 'Create database'}
            </button>
          </div>
        </div>
      )}

      {state.database.error !== undefined && (
        <p className="mt-3 text-sm text-red-600">{state.database.error.message}</p>
      )}
      {error !== undefined && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {log !== '' && (
        <pre className="mt-4 max-h-56 overflow-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-200">
          {log}
        </pre>
      )}

      {migrationId !== undefined && <MigrationPanel id={migrationId} />}
    </section>
  )
}

/** The migration's own terminal, shown once it has been run at least once. */
function MigrationPanel({ id }: { id: string }) {
  const [exists, setExists] = useState(false)

  useEffect(() => {
    const check = () =>
      window.prumo.apps.list().then((apps) => setExists(apps.some((one) => one.id === id)))

    check()

    return window.prumo.apps.onState((app) => {
      if (app.id === id) setExists(true)
    })
  }, [id])

  if (!exists) return null

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs text-neutral-500">pnpm db:migrate</p>
      <Terminal id={id} />
    </div>
  )
}
