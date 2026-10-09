// Against this machine's real apps. Nothing is opened: only an app outside the list is asked for, and refused.
import { tmpdir } from 'node:os'
import { expect, test } from 'vitest'
import { openers, openIn } from './open-in.ts'

const mac = process.platform === 'darwin'

test.runIf(mac)('finds Terminal, which every Mac has', async () => {
  expect((await openers()).terminals).toContain('Terminal')
})

test.skipIf(mac)('offers nothing where it cannot open an app yet', async () => {
  expect(await openers()).toEqual({ editors: [], terminals: [] })
})

test('refuses an app it did not find, whatever the renderer asks', async () => {
  expect(await openIn('Calculator', tmpdir())).toBe(false)
})
