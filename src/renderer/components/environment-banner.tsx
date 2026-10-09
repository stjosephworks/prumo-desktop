import { Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Environment } from '../../shared/ipc.ts'
import { buttonClass, Notice } from './ui.tsx'

/** Shown only when something is missing: `prumo doctor` decides what "missing" means, not the Desktop. */
export function EnvironmentBanner() {
  const [environment, setEnvironment] = useState<Environment>()

  useEffect(() => {
    window.prumo.environment().then(setEnvironment)
  }, [])

  if (environment === undefined || environment.ready) return null

  const missing = environment.checks.filter((check) => check.status === 'fail')

  return (
    <Notice
      tone="error"
      icon={<TriangleAlert />}
      action={
        <Link to="/environment" className={buttonClass('secondary', 'sm')}>
          See the checks
        </Link>
      }
    >
      {environment.node === undefined
        ? 'Node was not found on this machine, so nothing can run.'
        : `Not ready: ${missing.map((check) => check.label).join(', ')}.`}
    </Notice>
  )
}
