// Against the embedded CLI itself: a mock of it would only prove that the mock matches our assumptions.
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { CliError, doctor, runCli, version } from './cli.ts'
import { findNode } from './environment.ts'

const cli = join(import.meta.dirname, '..', '..', 'resources', 'prumo', 'dist', 'cli.js')

test('the CLI is embedded where the Desktop looks for it', () => {
  expect(existsSync(cli)).toBe(true)
})

test('finds the Node it runs everything with', async () => {
  const node = await findNode()

  expect(node?.path).toBeTruthy()
  expect(Number(node?.version.split('.')[0])).toBeGreaterThanOrEqual(22)
})

test('reads the embedded CLI version', async () => {
  expect(await version({ cli })).toMatch(/^\d+\.\d+\.\d+/)
})

test('doctor reports the checks, whether or not the machine is ready', async () => {
  const report = await doctor({ cli })

  expect(report.checks.map((check) => check.id)).toContain('node')
  expect(report.checks.find((check) => check.id === 'pnpm')?.required).toBe(true)
})

test('an invalid project name comes back as invalid_input, not as text to parse', async () => {
  const { envelope, exitCode } = await runCli(
    ['new', 'Bad Name', '--types', 'web', '--alone', '--single-tenant'],
    { cli, cwd: mkdtempSync(join(tmpdir(), 'prumo-desktop-cli-')) },
  )

  expect(exitCode).not.toBe(0)
  expect(envelope.ok).toBe(false)
  if (!envelope.ok) expect(envelope.error.code).toBe('invalid_input')
})

test('a missing CLI fails as a CliError, not as an unhandled crash', async () => {
  await expect(version({ cli: join(tmpdir(), 'no-such-cli.js') })).rejects.toBeInstanceOf(CliError)
})
