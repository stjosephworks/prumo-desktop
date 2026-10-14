// Against real HTTP servers on real ports, answering as a generated API's readiness route does.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, expect, test } from 'vitest'
import { apiHealth } from './health.ts'

let server: Server | undefined

/**
 * Longer than the screen's two seconds: a loaded CI runner, Windows most of all, has taken more than two to answer
 * a server in this same process, and a slow answer is not the unreachable one these tests tell apart.
 */
const PATIENT = 10_000

afterEach(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())))

/** A server that answers `/api/health/ready` with `status`, on a port the system picked. */
function serve(status: number): Promise<number> {
  const listening = createServer((request, response) => {
    response.statusCode = request.url === '/api/health/ready' ? status : 404
    response.end('{}')
  })
  server = listening

  return new Promise((done) =>
    listening.listen(0, () => done((listening.address() as AddressInfo).port)),
  )
}

test('200 is a ready API', async () => {
  expect(await apiHealth(await serve(200), PATIENT)).toBe('ready')
})

test('503 is an API that runs but cannot reach its database', async () => {
  expect(await apiHealth(await serve(503), PATIENT)).toBe('database_down')
})

test('nothing listening is unreachable', async () => {
  const port = await serve(200)
  await new Promise<void>((done) => server?.close(() => done()))
  server = undefined

  expect(await apiHealth(port, PATIENT)).toBe('unreachable')
})
