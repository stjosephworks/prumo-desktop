import { Play } from 'lucide-react'
import type { Project, RunningApp } from '../../shared/ipc.ts'
import type { Dictionary } from '../i18n/en.ts'
import { useT } from '../i18n/i18n.tsx'
import { useApps } from '../use-apps.ts'
import { Terminal } from './terminal.tsx'
import {
  Button,
  cx,
  ProgressBar,
  Section,
  StatusDot,
  TerminalToggle,
  useOutputPanel,
} from './ui.tsx'

/** Every Prumo project has these three at its root, alone or a workspace, and they are what CI runs. */
const CHECKS = ['lint', 'typecheck', 'test'] as const

type Outcome = { label: string; dot: 'running' | 'starting' | 'stopped' | 'failed'; tone: string }

function outcomeOf(app: RunningApp | undefined, t: Dictionary): Outcome {
  if (app === undefined) {
    return { label: t.checks.notRun, dot: 'stopped', tone: 'text-muted-foreground' }
  }
  if (app.state === 'starting' || app.state === 'running') {
    return { label: t.checks.running, dot: 'starting', tone: 'text-warning' }
  }
  if (app.state === 'failed') {
    return { label: t.checks.failed(app.exitCode ?? '?'), dot: 'failed', tone: 'text-destructive' }
  }
  // A check that exited by itself with 0 passed; one the user stopped did not finish.
  return app.exitCode === 0
    ? { label: t.checks.passed, dot: 'running', tone: 'text-success' }
    : { label: t.checks.stopped, dot: 'stopped', tone: 'text-muted-foreground' }
}

function CheckRow({ project, script }: { project: Project; script: (typeof CHECKS)[number] }) {
  const t = useT()
  const id = `${project.path}#${script}`
  const app = useApps().find((one) => one.id === id)
  const outcome = outcomeOf(app, t)
  const working = outcome.dot === 'starting'
  const [open, toggle] = useOutputPanel(app?.state === 'failed')

  return (
    <li>
      <div className="relative flex items-center justify-between gap-4 px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-navy">pnpm {script}</span>
            <span className={cx('flex items-center gap-1.5 text-xs', outcome.tone)}>
              <StatusDot state={outcome.dot} />
              {outcome.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t.checks[script]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {app !== undefined && (
            <TerminalToggle open={open} onToggle={toggle} failed={app.state === 'failed'} />
          )}
          <Button
            size="sm"
            disabled={working}
            onClick={() => window.prumo.apps.start({ project: project.path, script })}
          >
            <Play />
            {app === undefined ? t.checks.run : t.checks.runAgain}
          </Button>
        </div>
        {working && (
          <ProgressBar
            label={t.checks.runningWhat(script)}
            className="absolute inset-x-0 bottom-0"
          />
        )}
      </div>
      {app !== undefined && open && <Terminal id={id} />}
    </li>
  )
}

/** The project's own checks, run where the user can see them pass or fail, and read why when they fail. */
export function Checks({ project }: { project: Project }) {
  const t = useT()

  return (
    <Section
      className="mt-10"
      title={t.checks.title}
      aside={
        <Button
          size="sm"
          onClick={() => {
            for (const script of CHECKS) window.prumo.apps.start({ project: project.path, script })
          }}
        >
          <Play />
          {t.checks.runAll}
        </Button>
      }
    >
      <ul className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-card">
        {CHECKS.map((script) => (
          <CheckRow key={script} project={project} script={script} />
        ))}
      </ul>
    </Section>
  )
}
