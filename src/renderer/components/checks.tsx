import { Play } from 'lucide-react'
import type { Project, RunningApp } from '../../shared/ipc.ts'
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
const CHECKS = [
  { script: 'lint', detail: 'Biome, over the whole project' },
  { script: 'typecheck', detail: 'TypeScript, in every app' },
  { script: 'test', detail: 'Vitest, in every app' },
] as const

type Outcome = { label: string; dot: 'running' | 'starting' | 'stopped' | 'failed'; tone: string }

function outcomeOf(app: RunningApp | undefined): Outcome {
  if (app === undefined) return { label: 'not run', dot: 'stopped', tone: 'text-muted-foreground' }
  if (app.state === 'starting' || app.state === 'running') {
    return { label: 'running…', dot: 'starting', tone: 'text-warning' }
  }
  if (app.state === 'failed') {
    return {
      label: `failed (exit ${app.exitCode ?? '?'})`,
      dot: 'failed',
      tone: 'text-destructive',
    }
  }
  // A check that exited by itself with 0 passed; one the user stopped did not finish.
  return app.exitCode === 0
    ? { label: 'passed', dot: 'running', tone: 'text-success' }
    : { label: 'stopped', dot: 'stopped', tone: 'text-muted-foreground' }
}

function CheckRow({
  project,
  script,
  detail,
}: {
  project: Project
  script: string
  detail: string
}) {
  const id = `${project.path}#${script}`
  const app = useApps().find((one) => one.id === id)
  const outcome = outcomeOf(app)
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
          <p className="text-xs text-muted-foreground">{detail}</p>
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
            {app === undefined ? 'Run' : 'Run again'}
          </Button>
        </div>
        {working && (
          <ProgressBar label={`Running ${script}`} className="absolute inset-x-0 bottom-0" />
        )}
      </div>
      {app !== undefined && open && <Terminal id={id} />}
    </li>
  )
}

/** The project's own checks, run where the user can see them pass or fail, and read why when they fail. */
export function Checks({ project }: { project: Project }) {
  return (
    <Section
      className="mt-10"
      title="Checks"
      aside={
        <Button
          size="sm"
          onClick={() => {
            for (const check of CHECKS)
              window.prumo.apps.start({ project: project.path, script: check.script })
          }}
        >
          <Play />
          Run all checks
        </Button>
      }
    >
      <ul className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-card">
        {CHECKS.map((check) => (
          <CheckRow
            key={check.script}
            project={project}
            script={check.script}
            detail={check.detail}
          />
        ))}
      </ul>
    </Section>
  )
}
