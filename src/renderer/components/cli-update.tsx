import { ArrowDownToLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CliStatus } from '../../shared/ipc.ts'
import { useT } from '../i18n/i18n.tsx'
import { Button, Notice } from './ui.tsx'

/**
 * The Prumo CLI the Desktop runs, and an update when the registry has one it can run. On the project list it
 * shows only when there is something to update to; `detailed` also shows the version in use and why a newer
 * one is not offered.
 */
export function CliUpdate({ detailed = false }: { detailed?: boolean }) {
  const t = useT()
  const [status, setStatus] = useState<CliStatus>()
  const [updating, setUpdating] = useState(false)
  const [problem, setProblem] = useState<string>()

  useEffect(() => {
    window.prumo.cli.status().then(setStatus)
  }, [])

  const update = async () => {
    setUpdating(true)
    setProblem(undefined)
    const result = await window.prumo.cli.update()
    setUpdating(false)

    if (result.ok) setStatus(result.status)
    else setProblem(result.message)
  }

  if (status === undefined) return null
  if (!detailed && status.available === undefined) return null

  const offer = status.available !== undefined && (
    <Notice
      tone="brass"
      icon={<ArrowDownToLine className="text-brass-ink" />}
      action={
        <Button variant="primary" size="sm" onClick={update} disabled={updating}>
          {updating ? t.cli.updating : t.cli.update}
        </Button>
      }
    >
      Prumo CLI <span className="font-mono">{status.available}</span> {t.cli.available}{' '}
      <span className="font-mono">{status.version}</span>.
    </Notice>
  )

  if (!detailed) {
    return (
      <div className="space-y-2">
        {offer}
        {problem !== undefined && (
          <p className="text-sm text-destructive">{t.cli.failed(problem)}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-md border border-rule bg-card px-5 py-4">
        <span className="font-mono text-2xl font-medium text-navy">{status.version}</span>
        <div className="text-sm">
          <p className="text-ink">{status.source === 'updated' ? t.cli.updated : t.cli.shipped}</p>
          <p className="text-muted-foreground">
            {status.error !== undefined
              ? t.cli.couldNotCheck(status.error)
              : status.available === undefined && status.needsDesktop === undefined
                ? t.cli.upToDate
                : t.cli.newerExists}
          </p>
        </div>
      </div>

      {offer}
      {problem !== undefined && <p className="text-sm text-destructive">{t.cli.failed(problem)}</p>}

      {status.needsDesktop !== undefined && (
        <p className="text-sm text-muted-foreground">{t.cli.needsDesktop(status.needsDesktop)}</p>
      )}
    </div>
  )
}
