import { useEffect, useState } from 'react'
import { compareVersions } from '../../shared/versions.ts'
import { Tag } from './ui.tsx'

/** The first version that records itself in .prumo/config.json. */
const RECORDED_SINCE = '0.1.1'

/**
 * Which Prumo made the project, against the one the Desktop runs. An older project is not broken: its code is its
 * own, but conventions and templates may have moved on since, so it is said, not alarmed about.
 */
export function ProjectVersion({ made }: { made?: string }) {
  const [current, setCurrent] = useState<string>()

  useEffect(() => {
    window.prumo.cli.status().then((status) => setCurrent(status.version))
  }, [])

  if (current === undefined) return null

  if (made === undefined) {
    return (
      <span title={`Prumo records its version since ${RECORDED_SINCE}; this app runs ${current}.`}>
        <Tag tone="warning">made before Prumo {RECORDED_SINCE}</Tag>
      </span>
    )
  }

  if (compareVersions(made, current) < 0) {
    return (
      <span title={`Templates and conventions may have changed since ${made}.`}>
        <Tag tone="warning">
          Prumo {made} · this app runs {current}
        </Tag>
      </span>
    )
  }

  return <Tag>Prumo {made}</Tag>
}
