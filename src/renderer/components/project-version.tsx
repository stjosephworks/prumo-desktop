import { useEffect, useState } from 'react'
import { compareVersions } from '../../shared/versions.ts'
import { useT } from '../i18n/i18n.tsx'
import { Tag } from './ui.tsx'

/** The first version that records itself in .prumo/config.json. */
const RECORDED_SINCE = '0.1.1'

/**
 * Which Prumo made the project, against the one the Desktop runs. An older project is not broken: its code is its
 * own, but conventions and templates may have moved on since, so it is said, not alarmed about.
 */
export function ProjectVersion({ made }: { made?: string }) {
  const t = useT()
  const [current, setCurrent] = useState<string>()

  useEffect(() => {
    window.prumo.cli.status().then((status) => setCurrent(status.version))
  }, [])

  if (current === undefined) return null

  if (made === undefined) {
    return (
      <span title={t.project.madeBeforeTitle(RECORDED_SINCE, current)}>
        <Tag tone="warning">{t.project.madeBefore(RECORDED_SINCE)}</Tag>
      </span>
    )
  }

  if (compareVersions(made, current) < 0) {
    return (
      <span title={t.project.olderTitle(made)}>
        <Tag tone="warning">{t.project.older(made, current)}</Tag>
      </span>
    )
  }

  return <Tag>{t.project.made(made)}</Tag>
}
