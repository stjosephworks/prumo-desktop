import { Link, useSearch } from '@tanstack/react-router'
import {
  ArrowUpRight,
  BookOpen,
  Globe,
  Play,
  Server,
  Smartphone,
  Square,
  TriangleAlert,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import type { PortAnswer, PortCheck, Project, RunningApp } from '../../shared/ipc.ts'
import { type Part, partId, partsFor } from '../../shared/parts.ts'
import { browserUrl, expoUrl } from '../../shared/urls.ts'
import { Checks } from '../components/checks.tsx'
import { Database } from '../components/database.tsx'
import { ExpoQr } from '../components/expo-qr.tsx'
import { GitBadge } from '../components/git-badge.tsx'
import { McpPanel } from '../components/mcp.tsx'
import { OpenIn } from '../components/open-in.tsx'
import { ProjectVersion } from '../components/project-version.tsx'
import { Terminal } from '../components/terminal.tsx'
import {
  Button,
  buttonClass,
  cx,
  Notice,
  PageHeader,
  ProgressBar,
  Section,
  StatusDot,
  Tag,
  TerminalToggle,
  useOutputPanel,
} from '../components/ui.tsx'
import type { Dictionary } from '../i18n/en.ts'
import { useT } from '../i18n/i18n.tsx'
import { type ApiStatus, useApiHealth } from '../use-api-health.ts'
import { useAppOutput } from '../use-app-output.ts'
import { useApps } from '../use-apps.ts'
import { useProjects } from '../use-projects.ts'

/** What a card says about its app: a dot, a word, its colour, and whether it is still on its way. */
type Display = {
  dot: 'running' | 'starting' | 'stopped' | 'failed' | 'warning'
  label: (t: Dictionary) => string
  tone: string
  working: boolean
  failed: boolean
}

const DISPLAY: Record<RunningApp['state'], Display> = {
  starting: {
    dot: 'starting',
    label: (t) => t.common.states.starting,
    tone: 'text-warning',
    working: true,
    failed: false,
  },
  running: {
    dot: 'running',
    label: (t) => t.common.states.running,
    tone: 'text-success',
    working: false,
    failed: false,
  },
  stopped: {
    dot: 'stopped',
    label: (t) => t.common.states.stopped,
    tone: 'text-muted-foreground',
    working: false,
    failed: false,
  },
  failed: {
    dot: 'failed',
    label: (t) => t.common.states.failed,
    tone: 'text-destructive',
    working: false,
    failed: true,
  },
}

const API_DISPLAY: Record<ApiStatus, Display> = {
  starting: DISPLAY.starting,
  ready: DISPLAY.running,
  database_down: {
    dot: 'warning',
    label: (t) => t.project.databaseDown,
    tone: 'text-warning',
    working: false,
    failed: false,
  },
  not_responding: {
    dot: 'failed',
    label: (t) => t.project.notResponding,
    tone: 'text-destructive',
    working: false,
    failed: true,
  },
}

const ICON: Record<Part['type'], ReactNode> = {
  api: <Server />,
  web: <Globe />,
  site: <Globe />,
  mobile: <Smartphone />,
}

type Refused = Extract<PortCheck, { ok: false }>

function PortBusy({
  refused,
  onAnswer,
  onCancel,
}: {
  refused: Refused
  onAnswer: (answer: PortAnswer) => void
  onCancel: () => void
}) {
  const t = useT()

  return (
    <Notice
      tone="warning"
      icon={<TriangleAlert className="text-warning" />}
      className="mx-5 mb-4"
      action={
        refused.code === 'port_busy' && (
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => onAnswer('kill')}>
              {t.project.stopIt}
            </Button>
            <Button size="sm" onClick={() => onAnswer('change')}>
              {t.project.moveApp}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              {t.common.cancel}
            </Button>
          </div>
        )
      }
    >
      {/* The script's own words: it names the process, so nothing is stopped unnamed. */}
      {refused.message}
    </Notice>
  )
}

function PartPanel({
  project,
  part,
  app,
  refused,
  onStart,
  onCancel,
}: {
  project: Project
  part: Part
  app?: RunningApp
  refused?: Refused
  onStart: (answer?: PortAnswer) => void
  onCancel: () => void
}) {
  const t = useT()
  const id = partId(project, part)
  const state = app?.state ?? 'stopped'
  const busy = state === 'running' || state === 'starting'
  // A page server's address opens in a browser; mobile answers on a phone, through Expo's address below.
  const serves = part.type === 'web' || part.type === 'site'
  // Page servers are read for the address to open, Expo for the one a phone scans.
  const output = useAppOutput(id, busy && (serves || part.type === 'mobile'))
  const url = serves ? browserUrl(output) : undefined
  const phoneUrl = part.type === 'mobile' ? expoUrl(output) : undefined
  // A page server is still starting until it prints its address; the rest are started once they print anything.
  // An API is judged by its readiness route; a process that lives is not a server that answers.
  // The port the app was started on, kept with it in the main process, wherever it was started from.
  const apiPort = part.type === 'api' ? app?.port : undefined
  const health = useApiHealth(apiPort, busy)
  const display =
    health !== undefined
      ? API_DISPLAY[health]
      : state === 'running' && serves && url === undefined
        ? DISPLAY.starting
        : DISPLAY[state]
  const [open, toggle] = useOutputPanel(display.failed)

  return (
    <li className="overflow-hidden rounded-md border border-rule bg-card">
      <div className="relative flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-rule bg-paper text-navy [&_svg]:size-4">
            {ICON[part.type]}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif text-base font-semibold text-navy">{part.type}</span>
              <span className={cx('flex items-center gap-1.5 text-xs', display.tone)}>
                <StatusDot state={display.dot} />
                {display.label(t)}
                {state === 'failed' &&
                  app?.exitCode !== undefined &&
                  ` (${t.common.exit(app.exitCode)})`}
              </span>
            </div>
            <p className="font-mono text-[0.72rem] text-muted-foreground">pnpm {part.script}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* The address comes from what the app printed, so a dev server that moved port still opens. */}
          {url !== undefined && (
            <Button size="sm" onClick={() => window.prumo.openExternal(url)}>
              <ArrowUpRight />
              {t.common.open(url.replace(/^https?:\/\//, ''))}
            </Button>
          )}

          {/* Every generated API serves its OpenAPI reference here outside production; shown once it answers. */}
          {health === 'ready' && apiPort !== undefined && (
            <Button
              size="sm"
              onClick={() => window.prumo.openExternal(`http://localhost:${apiPort}/api/docs`)}
            >
              <BookOpen />
              {t.project.apiDocs}
            </Button>
          )}

          {/*
            Expo opens the simulators itself, through its own keyboard shortcuts, which only work while it runs.
            The Desktop presses the key instead of copying what Expo does behind it.
          */}
          {part.type === 'mobile' && busy && (
            <>
              <Button size="sm" onClick={() => window.prumo.apps.write(id, 'i')}>
                {t.project.ios}
              </Button>
              <Button size="sm" onClick={() => window.prumo.apps.write(id, 'a')}>
                {t.project.android}
              </Button>
            </>
          )}

          {app !== undefined && (
            <TerminalToggle open={open} onToggle={toggle} failed={display.failed} />
          )}

          <Button
            size="sm"
            variant={busy ? 'secondary' : 'primary'}
            onClick={() => (busy ? window.prumo.apps.stop(id) : onStart())}
          >
            {busy ? <Square /> : <Play />}
            {busy ? t.common.stop : t.common.start}
          </Button>
        </div>

        {display.working && (
          <ProgressBar
            label={t.project.startingWhat(part.type)}
            className="absolute inset-x-0 bottom-0"
          />
        )}
      </div>

      {busy && phoneUrl !== undefined && <ExpoQr url={phoneUrl} />}

      {refused !== undefined && (
        <PortBusy refused={refused} onAnswer={(answer) => onStart(answer)} onCancel={onCancel} />
      )}

      {/* Out of sight unless asked for, or unless the app failed: then its log is what matters. */}
      {app !== undefined && open && (
        <div className="border-t border-rule">
          <Terminal id={id} />
        </div>
      )}
    </li>
  )
}

export function ProjectScreen() {
  const { path } = useSearch({ from: '/project' })
  const projects = useProjects()
  const [refusals, setRefusals] = useState<Record<string, Refused>>({})
  const apps = useApps()
  const t = useT()
  const project = projects?.find((one) => one.path === path)

  if (projects === undefined) return null

  if (project === undefined) {
    return (
      <main className="mx-auto max-w-4xl px-10 pb-16">
        <PageHeader eyebrow={t.project.eyebrowMissing} title={t.project.missingTitle} />
        <p className="text-sm text-muted-foreground">
          {t.project.missingBody}{' '}
          <Link to="/" className="text-navy underline decoration-brass underline-offset-4">
            {t.project.back}
          </Link>
        </p>
      </main>
    )
  }

  const parts = partsFor(project)
  const appOf = (part: Part) => apps.find((one) => one.id === partId(project, part))
  const running = parts.filter((part) => {
    const state = appOf(part)?.state
    return state === 'running' || state === 'starting'
  })

  const apiPart = parts.find((part) => part.type === 'api')
  const runningType = (type: Part['type']) => running.some((part) => part.type === type)

  const forget = (part: Part) => setRefusals(({ [part.script]: _, ...rest }) => rest)

  /**
   * The port first, then the app. A port in use comes back as a question beside the app instead of a prompt
   * waiting inside its terminal, where the app would already look like it is running.
   */
  const start = async (part: Part, answer?: PortAnswer) => {
    const check = await window.prumo.apps.checkPort(project, part.type, answer)

    if (!check.ok) {
      setRefusals((current) => ({ ...current, [part.script]: check }))
      return
    }

    forget(part)
    window.prumo.apps.start({ project: project.path, script: part.script, port: check.port })
  }

  return (
    <main className="mx-auto max-w-4xl px-10 pb-16">
      <PageHeader
        eyebrow={
          <Link to="/" className="hover:text-navy">
            {t.project.eyebrow}
          </Link>
        }
        title={project.name}
        description={
          <div className="space-y-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <p className="truncate font-mono text-[0.72rem]">{project.path}</p>
              <GitBadge path={project.path} />
            </div>
            {project.config !== undefined && (
              <div className="flex flex-wrap gap-1.5">
                {project.config.types.map((type) => (
                  <Tag key={type}>{type}</Tag>
                ))}
                <Tag>{project.config.architecture}</Tag>
                {project.config.multiTenant && <Tag>multi-tenant</Tag>}
                {project.config.mcp && <Tag tone="brass">MCP</Tag>}
                {project.config.email && <Tag>email</Tag>}
                {project.config.social.map((provider) => (
                  <Tag key={provider}>{provider}</Tag>
                ))}
                <ProjectVersion made={project.config.prumo} />
              </div>
            )}
          </div>
        }
        actions={
          <>
            <OpenIn path={project.path} />
            <Link
              to="/docs"
              search={{ path: project.path, doc: 'INDEX.md' }}
              className={buttonClass('secondary')}
            >
              <BookOpen />
              {t.project.conventions}
            </Link>
          </>
        }
      />

      <Section
        title={t.project.apps}
        aside={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {t.projects.running(running.length, parts.length)}
            </span>
            {running.length > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  for (const part of parts) window.prumo.apps.stop(partId(project, part))
                }}
              >
                <Square />
                {t.project.stopAll}
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              disabled={running.length === parts.length}
              onClick={() => {
                // "Run all" starts each app separately: one mixed log cannot be stopped app by app.
                // An app already running holds its own port, so it is left out of the check.
                for (const part of parts) {
                  if (!running.includes(part)) start(part)
                }
              }}
            >
              <Play />
              {t.project.runAll}
            </Button>
          </div>
        }
      >
        <ul className="space-y-3">
          {parts.map((part) => (
            <PartPanel
              key={part.script}
              project={project}
              part={part}
              app={appOf(part)}
              refused={refusals[part.script]}
              onStart={(answer) => start(part, answer)}
              onCancel={() => forget(part)}
            />
          ))}
        </ul>
      </Section>

      <Checks project={project} />

      {project.config?.mcp === true && (
        <McpPanel
          name={project.name}
          apiPort={apiPart === undefined ? undefined : appOf(apiPart)?.port}
          apiRunning={runningType('api')}
          webRunning={runningType('web')}
        />
      )}

      <Database project={project} />
    </main>
  )
}
