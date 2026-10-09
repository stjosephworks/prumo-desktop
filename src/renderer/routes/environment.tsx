import { Check, CircleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Environment as Report } from '../../shared/ipc.ts'
import { CliUpdate } from '../components/cli-update.tsx'
import { cx, Notice, PageHeader, Section } from '../components/ui.tsx'

const MARK = {
  ok: { icon: Check, colour: 'text-success border-success/30 bg-success/10' },
  warn: { icon: CircleAlert, colour: 'text-warning border-warning/30 bg-warning/10' },
  fail: { icon: X, colour: 'text-destructive border-destructive/30 bg-destructive/10' },
} as const

/** What this machine has, straight from `prumo doctor`, and which Prumo CLI the Desktop runs. */
export function Environment() {
  const [report, setReport] = useState<Report>()

  useEffect(() => {
    window.prumo.environment().then(setReport)
  }, [])

  return (
    <main className="mx-auto max-w-3xl px-10 pb-16">
      <PageHeader
        eyebrow="prumo doctor"
        title="This machine"
        description="Every check comes from the CLI; the Desktop keeps no list of its own."
      />

      <div className="space-y-10">
        <Section title="Prumo CLI">
          <CliUpdate detailed />
        </Section>

        <Section
          title="Tools"
          aside={
            report?.node !== undefined && (
              <span className={cx('text-xs', report.ready ? 'text-success' : 'text-destructive')}>
                {report.ready ? 'Ready' : 'Not ready'}
              </span>
            )
          }
        >
          {report === undefined && <p className="text-sm text-muted-foreground">Checking…</p>}

          {report !== undefined && report.node === undefined && (
            <Notice tone="error" icon={<X />}>
              Node was not found. Install Node 22.17 or later, then reopen Prumo Desktop.
            </Notice>
          )}

          {report?.node !== undefined && (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Node {report.node.version} at{' '}
                <code className="font-mono text-[0.78rem] text-ink">{report.node.path}</code>
              </p>
              <ul className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-card">
                {report.checks.map((check) => {
                  const mark = MARK[check.status]
                  const Icon = mark.icon

                  return (
                    <li key={check.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                      <span
                        className={cx(
                          'flex size-6 shrink-0 items-center justify-center rounded-full border',
                          mark.colour,
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="w-32 shrink-0 font-medium">{check.label}</span>
                      <span className="min-w-0 flex-1 text-muted-foreground">{check.detail}</span>
                      {!check.required && (
                        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                          optional
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              {!report.ready && (
                <p className="mt-4 text-sm text-destructive">
                  Fix what is marked with a cross before creating a project.
                </p>
              )}
            </>
          )}
        </Section>
      </div>
    </main>
  )
}
