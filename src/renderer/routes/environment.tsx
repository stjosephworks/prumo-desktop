import { Check, CircleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Environment as Report } from '../../shared/ipc.ts'
import { CliUpdate } from '../components/cli-update.tsx'
import { cx, Notice, PageHeader, Section } from '../components/ui.tsx'
import { useT } from '../i18n/i18n.tsx'

const MARK = {
  ok: { icon: Check, colour: 'text-success border-success/30 bg-success/10' },
  warn: { icon: CircleAlert, colour: 'text-warning border-warning/30 bg-warning/10' },
  fail: { icon: X, colour: 'text-destructive border-destructive/30 bg-destructive/10' },
} as const

/** What this machine has, straight from `prumo doctor`, and which Prumo CLI the Desktop runs. */
export function Environment() {
  const t = useT()
  const [report, setReport] = useState<Report>()

  useEffect(() => {
    window.prumo.environment().then(setReport)
  }, [])

  return (
    <main className="mx-auto max-w-3xl px-10 pb-16">
      <PageHeader
        eyebrow="prumo doctor"
        title={t.nav.thisMachine}
        description={t.machine.description}
      />

      <div className="space-y-10">
        <Section title={t.machine.cli}>
          <CliUpdate detailed />
        </Section>

        <Section
          title={t.machine.tools}
          aside={
            report?.node !== undefined && (
              <span className={cx('text-xs', report.ready ? 'text-success' : 'text-destructive')}>
                {report.ready ? t.machine.ready : t.machine.notReady}
              </span>
            )
          }
        >
          {report === undefined && (
            <p className="text-sm text-muted-foreground">{t.machine.checking}</p>
          )}

          {report !== undefined && report.node === undefined && (
            <Notice tone="error" icon={<X />}>
              {t.machine.nodeMissing}
            </Notice>
          )}

          {report?.node !== undefined && (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Node {report.node.version} {t.machine.nodeAt}{' '}
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
                          {t.machine.optional}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              {!report.ready && <p className="mt-4 text-sm text-destructive">{t.machine.fix}</p>}
            </>
          )}
        </Section>
      </div>
    </main>
  )
}
