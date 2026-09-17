// Every call to the embedded CLI. It is the only way the Desktop reaches Prumo, and it always runs with --json:
// stdout carries exactly one document, stderr carries the log meant for a person.
// Never inside a pseudo terminal, which merges the two streams and breaks reading the document.
import { spawn } from 'node:child_process'
import type { Check } from '../shared/ipc.ts'
import { findNode } from './environment.ts'

export type Envelope<T> =
  | { ok: true; command: string; data: T }
  | { ok: false; command: string; error: { code: string; message: string }; data?: unknown }

/** An envelope plus what a person would have seen: the CLI's own log, and the exit code. */
export type CliResult<T> = { envelope: Envelope<T>; log: string; exitCode: number | null }

export class CliError extends Error {
  readonly code: string
  readonly log: string

  constructor(code: string, message: string, log: string) {
    super(message)
    this.code = code
    this.log = log
  }
}

export type CliOptions = {
  /** Where the embedded `dist/cli.js` sits. */
  cli: string
  /** The working directory the command runs in: `db` and `clean` read it to find the project. */
  cwd?: string
  onLog?: (chunk: string) => void
}

/** Runs one CLI command and returns its document, its log and its exit code, without throwing. */
export async function runCli<T>(
  args: string[],
  { cli, cwd, onLog }: CliOptions,
): Promise<CliResult<T>> {
  const node = await findNode()

  if (node === undefined) {
    throw new CliError('no_node', 'Node was not found on this machine.', '')
  }

  return new Promise((done, fail) => {
    const child = spawn(node.path, [cli, ...args, '--json'], { cwd, env: process.env })
    let out = ''
    let log = ''

    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      log += text
      onLog?.(text)
    })
    child.on('error', (error) => fail(new CliError('spawn_failed', error.message, log)))
    child.on('close', (exitCode) => {
      try {
        done({ envelope: JSON.parse(out) as Envelope<T>, log, exitCode })
      } catch {
        // A CLI that cannot even print its document is a broken embed, not a command that failed.
        fail(
          new CliError(
            'unreadable',
            `The CLI printed no JSON document (exit ${exitCode}): ${out.slice(0, 200)}`,
            log,
          ),
        )
      }
    })
  })
}

/** The same call, but a CLI error becomes a `CliError` carrying the code the Desktop branches on. */
export async function callCli<T>(args: string[], options: CliOptions): Promise<T> {
  const { envelope, log } = await runCli<T>(args, options)

  if (!envelope.ok) {
    throw new CliError(envelope.error.code, envelope.error.message, log)
  }

  return envelope.data
}

export type DoctorReport = { ready: boolean; checks: Check[] }

/**
 * `prumo doctor`, which owns the list of checks: Node, pnpm and git are required, Docker is a warning.
 * It exits with `not_ready` when a required check fails, and carries the same report in `data`.
 */
export async function doctor(options: CliOptions): Promise<DoctorReport> {
  const { envelope } = await runCli<DoctorReport>(['doctor'], options)

  if (envelope.ok) return envelope.data

  if (envelope.error.code === 'not_ready' && envelope.data !== undefined) {
    return envelope.data as DoctorReport
  }

  throw new CliError(envelope.error.code, envelope.error.message, '')
}

export async function version(options: CliOptions): Promise<string> {
  return (await callCli<{ version: string }>(['version'], options)).version
}
