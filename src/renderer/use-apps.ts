import { useEffect, useState } from 'react'
import type { RunningApp } from '../shared/ipc.ts'

/** Every app the Desktop started, kept current by the state the main process pushes. */
export function useApps(): RunningApp[] {
  const [apps, setApps] = useState<RunningApp[]>([])

  useEffect(() => {
    window.prumo.apps.list().then(setApps)

    return window.prumo.apps.onState((changed) => {
      setApps((current) => {
        const known = current.some((one) => one.id === changed.id)

        return known
          ? current.map((one) => (one.id === changed.id ? changed : one))
          : [...current, changed]
      })
    })
  }, [])

  return apps
}
