import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { Environment } from '../../shared/ipc.ts'

/** Shown only when something is missing: `prumo doctor` decides what "missing" means, not the Desktop. */
export function EnvironmentBanner() {
  const [environment, setEnvironment] = useState<Environment>()

  useEffect(() => {
    window.prumo.environment().then(setEnvironment)
  }, [])

  if (environment === undefined || environment.ready) return null

  const missing = environment.checks.filter((check) => check.status === 'fail')

  return (
    <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
      {environment.node === undefined
        ? 'Node was not found on this machine, so nothing can run.'
        : `Not ready: ${missing.map((check) => check.label).join(', ')}.`}{' '}
      <Link to="/environment" className="underline">
        See the checks
      </Link>
    </p>
  )
}
