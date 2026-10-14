// Whether an API is serving, from its own readiness route. A process that is alive is not an API that answers:
// under `node --watch` a crashed server keeps its process, waiting for a change. No Electron here.
import type { ApiHealth } from '../shared/ipc.ts'

/** Every generated API serves this, outside the auth guard, and checks its database on each call. */
const READY = '/api/health/ready'

/** Two seconds by default: the project screen asks again soon enough, and a hung server must not hold it. */
export async function apiHealth(port: number, timeoutMs = 2_000): Promise<ApiHealth> {
  try {
    const response = await fetch(`http://localhost:${port}${READY}`, {
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (response.ok) return 'ready'
    // 503 is the route's own answer for a database it cannot reach; anything else is a server not ready yet.
    return response.status === 503 ? 'database_down' : 'unreachable'
  } catch {
    return 'unreachable'
  }
}
