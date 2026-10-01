import { Link, useSearch } from '@tanstack/react-router'
import {
  ArrowUpRight,
  BookOpen,
  FolderOpen,
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
import { Database } from '../components/database.tsx'
import { ExpoQr } from '../components/expo-qr.tsx'
import { McpPanel } from '../components/mcp.tsx'
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
import { type ApiStatus, useApiHealth } from '../use-api-health.ts'
import { useAppOutput } from '../use-app-output.ts'
import { useApps } from '../use-apps.ts'
import { useProjects } from '../use-projects.ts'

/** What a card says about its app: a dot, a word, its colour, and whether it is still on its way. */
type Display = {
  dot: 'running' | 'starting' | 'stopped' | 'failed' | 'warning'
  label: string
  tone: string
  working: boolean
  failed: boolean
}

const DISPLAY: Record<RunningApp['state'], Display> = {
  starting: {
    dot: 'starting',
    label: 'starting',
    tone: 'text-warning',
    working: true,
    failed: false,
  },
  running: {
    dot: 'running',
    label: 'running',
    tone: 'text-success',
    working: false,
    failed: false,
  },
  stopped: {
    dot: 'stopped',
    label: 'stopped',
    tone: 'text-muted-foreground',
    working: false,
    failed: false,
  },
  failed: {
    dot: 'failed',
    label: 'failed',
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
    label: 'database down',
    tone: 'text-warning',
    working: false,
    failed: false,
  },
  not_responding: {
    dot: 'failed',
    label: 'not responding',
    tone: 'text-destructive',
    working: false,
    failed: true,
  },
}

/**
 * The port each API was started on, as its check settled it, by app id. Kept outside the screen so that leaving
 * and coming back still knows where to ask for the API's health.
 */
const settledPorts = new Map<string, number>()

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
  return (
    <Notice
      tone="warning"
      icon={<TriangleAlert className="text-warning" />}
      className="mx-5 mb-4"
      action={
        refused.code === 'port_busy' && (
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => onAnswer('kill')}>
              Stop it
            </Button>
            <Button size="sm" onClick={() => onAnswer('change')}>
              Move this app
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
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
  const apiPort = part.type === 'api' ? settledPorts.get(id) : undefined
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
                {display.label}
                {state === 'failed' && app?.exitCode !== undefined && ` (exit ${app.exitCode})`}
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
              Open {url.replace(/^https?:\/\//, '')}
            </Button>
          )}

          {/* Every generated API serves its OpenAPI reference here outside production; shown once it answers. */}
          {health === 'ready' && apiPort !== undefined && (
            <Button
              size="sm"
              onClick={() => window.prumo.openExternal(`http://localhost:${apiPort}/api/docs`)}
            >
              <BookOpen />
              API docs
            </Button>
          )}

          {/*
            Expo opens the simulators itself, through its own keyboard shortcuts, which only work while it runs.
            The Desktop presses the key instead of copying what Expo does behind it.
          */}
          {part.type === 'mobile' && busy && (
            <>
              <Button size="sm" onClick={() => window.prumo.apps.write(id, 'i')}>
                iOS simulator
              </Button>
              <Button size="sm" onClick={() => window.prumo.apps.write(id, 'a')}>
                Android emulator
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
            {busy ? 'Stop' : 'Start'}
          </Button>
        </div>

        {display.working && (
          <ProgressBar label={`Starting ${part.type}`} className="absolute inset-x-0 bottom-0" />
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
  const project = projects?.find((one) => one.path === path)

  if (projects === undefined) return null

  if (project === undefined) {
    return (
      <main className="mx-auto max-w-4xl px-10 pb-16">
        <PageHeader eyebrow="Project" title="Not in the list" />
        <p className="text-sm text-muted-foreground">
          This project is no longer in the list.{' '}
          <Link to="/" className="text-navy underline decoration-brass underline-offset-4">
            Back to projects
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
    if (check.port !== undefined) settledPorts.set(partId(project, part), check.port)
    window.prumo.apps.start({ project: project.path, script: part.script })
  }

  return (
    <main className="mx-auto max-w-4xl px-10 pb-16">
      <PageHeader
        eyebrow={
          <Link to="/" className="hover:text-navy">
            Projects /
          </Link>
        }
        title={project.name}
        description={
          <div className="space-y-2.5">
            <p className="truncate font-mono text-[0.72rem]">{project.path}</p>
            {project.config !== undefined && (
              <div className="flex flex-wrap gap-1.5">
                {project.config.types.map((type) => (
                  <Tag key={type}>{type}</Tag>
                ))}
                <Tag>{project.config.architecture}</Tag>
                {project.config.multiTenant && <Tag>multi-tenant</Tag>}
                {project.config.mcp && <Tag tone="brass">MCP</Tag>}
                <ProjectVersion made={project.config.prumo} />
              </div>
            )}
          </div>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => window.prumo.projects.reveal(project.path)}>
              <FolderOpen />
              Open folder
            </Button>
            <Link
              to="/docs"
              search={{ path: project.path, doc: 'INDEX.md' }}
              className={buttonClass('secondary')}
            >
              <BookOpen />
              Conventions
            </Link>
          </>
        }
      />

      <Section
        title="Apps"
        aside={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {running.length} of {parts.length} running
            </span>
            {running.length > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  for (const part of parts) window.prumo.apps.stop(partId(project, part))
                }}
              >
                <Square />
                Stop all
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
              Run all
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

      {project.config?.mcp === true && (
        <McpPanel
          name={project.name}
          apiPort={apiPart === undefined ? undefined : settledPorts.get(partId(project, apiPart))}
          apiRunning={runningType('api')}
          webRunning={runningType('web')}
        />
      )}

      <Database project={project} />
    </main>
  )
}
