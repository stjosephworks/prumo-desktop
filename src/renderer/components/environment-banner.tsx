import { Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Environment } from '../../shared/ipc.ts'
import { useT } from '../i18n/i18n.tsx'
import { buttonClass, Notice } from './ui.tsx'

/** Shown only when something is missing: `prumo doctor` decides what "missing" means, not the Desktop. */
export function EnvironmentBanner() {
  const t = useT()
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
          {t.banner.seeChecks}
        </Link>
      }
    >
      {environment.node === undefined
        ? t.banner.nodeMissing
        : t.banner.notReady(missing.map((check) => check.label).join(', '))}
    </Notice>
  )
}
