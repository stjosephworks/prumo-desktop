import { expect, test } from 'vitest'
import { browserUrl, stripAnsi } from './urls.ts'

const ESC = '\u001b'
// Shaped like a real run in a pseudo terminal, colours included.
const VITE = `${ESC}[32m➜${ESC}[39m  ${ESC}[1mLocal${ESC}[22m:   ${ESC}[36mhttp://localhost:${ESC}[1m5174${ESC}[22m/${ESC}[39m\r\n`

test('reads the address through the colours a dev server uses', () => {
  expect(stripAnsi(VITE)).toContain('http://localhost:5174/')
  expect(browserUrl(VITE)).toBe('http://localhost:5174')
})

test('takes the last address, since a server that moves port announces the new one', () => {
  const buffer = 'Local: http://localhost:3000\nPort taken, using http://localhost:3001\n'

  expect(browserUrl(buffer)).toBe('http://localhost:3001')
})

test('an app that printed no address has none to open', () => {
  expect(browserUrl('compiling…\n')).toBeUndefined()
  // Expo prints an exp:// URL, which is for a phone, not for a browser.
  expect(browserUrl('Metro waiting on exp://192.168.0.3:8082\n')).toBeUndefined()
})
