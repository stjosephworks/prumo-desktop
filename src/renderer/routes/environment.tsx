import { useEffect, useState } from 'react'
import type { Environment as Report } from '../../shared/ipc.ts'

const COLOURS = {
  ok: 'text-emerald-600',
  warn: 'text-amber-600',
  fail: 'text-red-600',
} as const

const SYMBOLS = { ok: '✓', warn: '!', fail: '✗' } as const

/** The first screen while the features are not built: what this machine has, straight from `prumo doctor`. */
export function Environment() {
  const [report, setReport] = useState<Report>()

  useEffect(() => {
    window.prumo.environment().then(setReport)
  }, [])

  return (
    <main className="mx-auto max-w-2xl px-8 py-16">
      <h1 className="text-2xl font-semibold">Prumo Desktop</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Foundation only: the environment and process layers exist, the features do not yet.
      </p>

      <section className="mt-8">
        {report === undefined && <p className="text-sm text-neutral-500">Checking…</p>}

        {report !== undefined && report.node === undefined && (
          <p className="text-sm text-red-600">
            Node was not found. Install Node 22.17 or later, then reopen Prumo Desktop.
          </p>
        )}

        {report?.node !== undefined && (
          <>
            <p className="text-sm text-neutral-500">
              Node {report.node.version} at <code>{report.node.path}</code>
            </p>
            <ul className="mt-4 space-y-2">
              {report.checks.map((check) => (
                <li key={check.id} className="flex gap-3 text-sm">
                  <span className={COLOURS[check.status]}>{SYMBOLS[check.status]}</span>
                  <span className="w-28 shrink-0 font-medium">{check.label}</span>
                  <span className="text-neutral-500">{check.detail}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm">
              {report.ready
                ? 'Ready.'
                : 'Not ready: fix what is marked ✗ before creating a project.'}
            </p>
          </>
        )}
      </section>
    </main>
  )
}
