import { useEffect, useState } from 'react'
import type { CliStatus } from '../../shared/ipc.ts'

/**
 * The Prumo CLI the Desktop runs, and an update when the registry has one it can run. On the project list it
 * shows only when there is something to update to; `detailed` also shows the version in use and why a newer
 * one is not offered.
 */
export function CliUpdate({ detailed = false }: { detailed?: boolean }) {
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

  return (
    <div className="mt-6 space-y-1 text-sm">
      {detailed && (
        <p className="text-neutral-500">
          Prumo CLI {status.version}
          {status.source === 'updated'
            ? ', updated from the one this app ships'
            : ', shipped with this app'}
          .
        </p>
      )}

      {status.available !== undefined && (
        <div className="flex items-center justify-between gap-4 rounded-md bg-sky-50 px-4 py-3 text-sky-900">
          <span>
            Prumo CLI {status.available} is available; this app runs {status.version}.
          </span>
          <button
            type="button"
            onClick={update}
            disabled={updating}
            className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-700 disabled:opacity-40"
          >
            {updating ? 'Updating…' : 'Update'}
          </button>
        </div>
      )}

      {problem !== undefined && <p className="text-red-600">The update failed: {problem}</p>}

      {detailed && status.needsDesktop !== undefined && (
        <p className="text-neutral-500">
          Prumo {status.needsDesktop} is out. It may change what this app relies on, so it comes
          with a newer Prumo Desktop.
        </p>
      )}

      {detailed && status.error !== undefined && (
        <p className="text-neutral-500">Could not check for a newer CLI: {status.error}</p>
      )}

      {detailed &&
        status.available === undefined &&
        status.needsDesktop === undefined &&
        status.error === undefined && <p className="text-neutral-500">It is up to date.</p>}
    </div>
  )
}
