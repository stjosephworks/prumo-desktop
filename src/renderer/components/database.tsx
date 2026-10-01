import {
  ArrowUpFromLine,
  Check,
  Database as DatabaseIcon,
  Play,
  Square,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { DatabaseCreated, DatabaseState, DockerState, Project } from '../../shared/ipc.ts'
import { apiDirectory } from '../../shared/parts.ts'
import { useT } from '../i18n/i18n.tsx'
import { useApps } from '../use-apps.ts'
import { Terminal } from './terminal.tsx'
import {
  Button,
  cx,
  INPUT,
  LogBlock,
  Notice,
  ProgressBar,
  Section,
  StatusDot,
  TerminalToggle,
  useOutputPanel,
} from './ui.tsx'

/** Where the project's own database script sends someone without Docker (scripts/database.mjs). */
const DOCKER_DOWNLOAD = 'https://www.docker.com/products/docker-desktop/'

/** The database part of a project: created through `prumo db`, run by Docker, migrated on request. */
export function Database({ project }: { project: Project }) {
  const t = useT()
  const [state, setState] = useState<{ database: DatabaseState; docker: DockerState }>()
  const [name, setName] = useState(project.name.replaceAll('-', '_'))
  const [working, setWorking] = useState<string>()
  const [error, setError] = useState<string>()
  const [errorCode, setErrorCode] = useState<string>()
  const [created, setCreated] = useState<Extract<DatabaseCreated, { ok: true }>>()
  const [log, setLog] = useState('')

  const api = apiDirectory(project)
  const migrationId = api === undefined ? undefined : `${api}#db:migrate`

  const refresh = useCallback(() => {
    window.prumo.database.state(project).then(setState)
  }, [project])

  useEffect(refresh, [refresh])
  useEffect(() => window.prumo.database.onLog((chunk) => setLog((all) => all + chunk)), [])
  const [logOpen, toggleLog] = useOutputPanel(error !== undefined)

  if (state === undefined || !state.database.part) return null

  const docker = state.docker
  const containerRunning =
    docker.part &&
    docker.docker === 'running' &&
    docker.services.some((one) => one.state === 'running')
  // Docker's own answer for the host port, so the Desktop never reads the API's .env for it.
  const port = docker.part ? docker.services.find((one) => one.port !== undefined)?.port : undefined

  const openDocker = () =>
    act('open-docker', async () => {
      if (!(await window.prumo.database.openDocker())) {
        setError(t.database.didNotStart)
      }
    })

  const act = async (label: string, action: () => Promise<unknown>) => {
    setWorking(label)
    setError(undefined)
    setErrorCode(undefined)
    await action()
    setWorking(undefined)
    refresh()
  }

  return (
    <Section
      className="mt-10"
      title={t.database.title}
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
              {containerRunning ? t.common.stop : t.common.start}
            </Button>
            {/* Migrations never run by themselves: they are asked for, and their output is a terminal like any other. */}
            <Button
              size="sm"
              onClick={() =>
                api !== undefined && window.prumo.apps.start({ project: api, script: 'db:migrate' })
              }
            >
              <ArrowUpFromLine />
              {t.database.migrate}
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
                {state.database.created ? t.database.created : t.database.notCreated}
                {docker.part &&
                  docker.docker === 'running' &&
                  ` · ${t.database.docker(containerRunning)}`}
                {port !== undefined && ` · ${t.database.port(port)}`}
              </span>
            </div>
            <p className="font-mono text-[0.72rem] text-muted-foreground">{t.database.subtitle}</p>
          </div>
        </div>

        <div className="space-y-4 px-5 pb-5 empty:hidden">
          {docker.part && docker.docker !== 'running' && (
            <Notice
              tone="warning"
              icon={<TriangleAlert className="text-warning" />}
              action={
                docker.docker === 'stopped' && (
                  <Button size="sm" disabled={working !== undefined} onClick={openDocker}>
                    {working === 'open-docker' ? t.database.openingButton : t.database.openDocker}
                  </Button>
                )
              }
            >
              {working === 'open-docker'
                ? t.database.opening
                : docker.docker === 'missing'
                  ? t.database.missing
                  : t.database.stopped}
            </Notice>
          )}

          {!state.database.created && (
            <div>
              <p className="text-sm text-muted-foreground">
                {t.database.introBefore}{' '}
                <code className="font-mono text-[0.8rem] text-ink">DATABASE_URL=MISSING</code>
                {t.database.introAfter}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-label={t.database.nameLabel}
                  className={`${INPUT} max-w-xs font-mono`}
                />
                <Button
                  variant="primary"
                  disabled={working !== undefined || name === ''}
                  onClick={() =>
                    act('create', async () => {
                      setLog('')
                      setCreated(undefined)
                      const result = await window.prumo.database.create(project, name)
                      if (result.ok) {
                        setCreated(result)
                      } else {
                        setError(result.message)
                        setErrorCode(result.code)
                      }
                    })
                  }
                >
                  {working === 'create' ? t.database.creating : t.database.create}
                </Button>
              </div>
            </div>
          )}

          {state.database.error !== undefined && (
            <p className="text-sm text-destructive">{state.database.error.message}</p>
          )}
          {created !== undefined && (
            <Notice tone="info" icon={<Check className="text-success" />}>
              <span className="font-mono">{created.database}</span>{' '}
              {created.created ? t.database.wasCreated : t.database.alreadyExisted}{' '}
              {t.database.onPort} <span className="font-mono">{created.port}</span>
              {created.migrated ? t.database.migrated : t.database.notMigrated}
            </Notice>
          )}

          {/* Docker's two failures have a way out; anything else is the command's own words. */}
          {error !== undefined && errorCode === 'docker_not_running' && (
            <Notice
              tone="error"
              icon={<TriangleAlert />}
              action={
                <Button size="sm" disabled={working !== undefined} onClick={openDocker}>
                  {working === 'open-docker' ? t.database.openingButton : t.database.openDocker}
                </Button>
              }
            >
              {t.database.notRunningRetry}
            </Notice>
          )}
          {error !== undefined && errorCode === 'docker_missing' && (
            <Notice
              tone="error"
              icon={<TriangleAlert />}
              action={
                <Button size="sm" onClick={() => window.prumo.openExternal(DOCKER_DOWNLOAD)}>
                  {t.database.getDocker}
                </Button>
              }
            >
              {t.database.missing}
            </Notice>
          )}
          {error !== undefined &&
            errorCode !== 'docker_not_running' &&
            errorCode !== 'docker_missing' && <p className="text-sm text-destructive">{error}</p>}

          {working === 'create' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t.database.creatingProgress}</p>
              <ProgressBar label={t.database.creatingLabel} />
            </div>
          )}

          {log !== '' && (
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[0.72rem] text-muted-foreground">prumo db</span>
              <TerminalToggle open={logOpen} onToggle={toggleLog} failed={error !== undefined} />
            </div>
          )}
          {log !== '' && logOpen && <LogBlock className="max-h-56">{log}</LogBlock>}
        </div>

        {migrationId !== undefined && <MigrationPanel id={migrationId} />}
      </div>
    </Section>
  )
}

/** The migration, once it has run: a bar while it works, and its terminal only when asked for or when it failed. */
function MigrationPanel({ id }: { id: string }) {
  const t = useT()
  const app = useApps().find((one) => one.id === id)
  const failed = app?.state === 'failed'
  const [open, toggle] = useOutputPanel(failed)

  if (app === undefined) return null

  const working = app.state === 'starting' || app.state === 'running'

  return (
    <div className="border-t border-rule">
      <div className="relative flex items-center justify-between gap-3 px-5 py-2">
        <span className="flex items-center gap-2 font-mono text-[0.72rem] text-muted-foreground">
          pnpm db:migrate
          <span
            className={cx(
              'font-sans text-xs',
              failed ? 'text-destructive' : working ? 'text-warning' : 'text-success',
            )}
          >
            {t.database.migration[app.state]}
            {failed && app.exitCode !== undefined && ` (${t.common.exit(app.exitCode)})`}
          </span>
        </span>
        <TerminalToggle open={open} onToggle={toggle} failed={failed} />
        {working && (
          <ProgressBar label={t.database.migrating} className="absolute inset-x-0 bottom-0" />
        )}
      </div>
      {open && <Terminal id={id} />}
    </div>
  )
}
