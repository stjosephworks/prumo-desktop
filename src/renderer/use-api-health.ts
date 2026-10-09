import { useEffect, useRef, useState } from 'react'
import type { ApiHealth } from '../shared/ipc.ts'

/** What the screen says about an API: its readiness, read over time rather than from one answer. */
export type ApiStatus = 'starting' | 'ready' | 'database_down' | 'not_responding'

const EVERY_MS = 2_000
/** Long enough for a cold start with SWC and a first database connection, short enough to notice a crash. */
const GIVE_UP_MS = 30_000

/**
 * Asks the API on `port` whether it is ready, every two seconds while `alive`. Silence before it first answers is
 * a start; silence after, or for too long, is a server that stopped responding while its process lives on.
 */
export function useApiHealth(port: number | undefined, alive: boolean): ApiStatus | undefined {
  const [health, setHealth] = useState<ApiHealth>()
  const [late, setLate] = useState(false)
  const everReady = useRef(false)

  useEffect(() => {
    setHealth(undefined)
    setLate(false)
    everReady.current = false

    if (port === undefined || !alive) return

    let stopped = false
    const ask = async () => {
      const answer = await window.prumo.apps.health(port)
      if (stopped) return
      if (answer === 'ready') everReady.current = true
      setHealth(answer)
    }

    ask()
    const poll = setInterval(ask, EVERY_MS)
    const giveUp = setTimeout(() => setLate(true), GIVE_UP_MS)

    return () => {
      stopped = true
      clearInterval(poll)
      clearTimeout(giveUp)
    }
  }, [port, alive])

  if (port === undefined || !alive) return undefined
  if (health === 'ready' || health === 'database_down') return health

  return everReady.current || late ? 'not_responding' : 'starting'
}
