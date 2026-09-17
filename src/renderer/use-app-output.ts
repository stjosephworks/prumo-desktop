import { useEffect, useState } from 'react'

/**
 * What an app has written so far, kept current as it writes more. The screen reads addresses out of it: the
 * Desktop holds no copy of any template's port, so the app's own announcement is the only source.
 */
export function useAppOutput(id: string, enabled: boolean): string {
  const [output, setOutput] = useState('')

  useEffect(() => {
    if (!enabled) return

    window.prumo.apps.buffer(id).then(setOutput)

    return window.prumo.apps.onOutput((appId, data) => {
      if (appId === id) setOutput((all) => all + data)
    })
  }, [id, enabled])

  return output
}
