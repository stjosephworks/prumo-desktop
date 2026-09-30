import {
  ArrowUpFromLine,
  Database as DatabaseIcon,
  Play,
  Square,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { DatabaseState, DockerState, Project } from '../../shared/ipc.ts'
import { apiDirectory } from '../../shared/parts.ts'
import { Terminal } from './terminal.tsx'
import { Button, INPUT, LogBlock, Notice, Section, StatusDot } from './ui.tsx'

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
    <Section
      className="mt-10"
      title="Database"
      aside={
        state.database.created &&
        docker.part &&
        docker.docker === 'running' && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              disabled={working !== undefined}
              onClick={() =>
                act('docker', () =>
                  containerRunning
                    ? window.prumo.database.stopDocker(project)
                    : window.prumo.database.startDocker(project),
                )
              }
            >
              {containerRunning ? <Square /> : <Play />}
              {containerRunning ? 'Stop' : 'Start'}
            </Button>
            {/* Migrations never run by themselves: they are asked for, and their output is a terminal like any other. */}
            <Button
              size="sm"
              onClick={() =>
                api !== undefined && window.prumo.apps.start({ project: api, script: 'db:migrate' })
              }
            >
              <ArrowUpFromLine />
              Migrate
            </Button>
          </div>
        )
      }
    >
      <div className="rounded-md border border-rule bg-card">
        <div className="flex items-center gap-3.5 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-rule bg-paper text-navy">
            <DatabaseIcon className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-base font-semibold text-navy">PostgreSQL</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <StatusDot state={containerRunning ? 'running' : 'stopped'} />
                {state.database.created ? 'created' : 'not created yet'}
                {docker.part &&
                  docker.docker === 'running' &&
                  ` · Docker ${containerRunning ? 'up' : 'down'}`}
              </span>
            </div>
            <p className="font-mono text-[0.72rem] text-muted-foreground">prumo db, in Docker</p>
          </div>
        </div>

        <div className="space-y-4 px-5 pb-5 empty:hidden">
          {docker.part && docker.docker !== 'running' && (
            <Notice tone="warning" icon={<TriangleAlert className="text-warning" />}>
              {DOCKER_MESSAGE[docker.docker]}
            </Notice>
          )}

          {!state.database.created && (
            <div>
              <p className="text-sm text-muted-foreground">
                The API starts with{' '}
                <code className="font-mono text-[0.8rem] text-ink">DATABASE_URL=MISSING</code>.
                Creating the database writes its URL and runs the migrations.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-label="Database name"
                  className={`${INPUT} max-w-xs font-mono`}
                />
                <Button
                  variant="primary"
                  disabled={working !== undefined || name === ''}
                  onClick={() =>
                    act('create', async () => {
                      setLog('')
                      const result = await window.prumo.database.create(project, name)
                      if (!result.ok) setError(result.message)
                    })
                  }
                >
                  {working === 'create' ? 'Creating…' : 'Create database'}
                </Button>
              </div>
            </div>
          )}

          {state.database.error !== undefined && (
            <p className="text-sm text-destructive">{state.database.error.message}</p>
          )}
          {error !== undefined && <p className="text-sm text-destructive">{error}</p>}

          {log !== '' && <LogBlock className="max-h-56">{log}</LogBlock>}
        </div>

        {migrationId !== undefined && <MigrationPanel id={migrationId} />}
      </div>
    </Section>
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
    <div className="border-t border-rule">
      <p className="px-5 py-2 font-mono text-[0.72rem] text-muted-foreground">pnpm db:migrate</p>
      <Terminal id={id} />
    </div>
  )
}
