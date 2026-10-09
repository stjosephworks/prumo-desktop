import { inflateSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { plumbPng } from './tray-icon.ts'

test('draws a PNG of the asked height, black with alpha, inked down its middle', () => {
  const { png, width, height } = plumbPng(36)

  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
  expect(png.readUInt32BE(16)).toBe(width)
  expect(png.readUInt32BE(20)).toBe(height)
  expect(height).toBe(36)

  // IDAT starts after the signature (8) and IHDR (25): length, type, then the deflated rows.
  const idat = png.subarray(33 + 8, 33 + 8 + png.readUInt32BE(33))
  const pixels = inflateSync(idat)
  const alpha = (x: number, y: number) => pixels[y * (1 + width * 4) + 1 + x * 4 + 3] ?? 0
  const middle = Math.floor(width / 2)

  expect(alpha(middle, Math.floor(height * 0.6))).toBeGreaterThan(200)
  expect(alpha(0, 0)).toBe(0)
  // Template images are black: every pixel's red, green and blue are zero, only its alpha varies.
  const coloured = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * (1 + width * 4) + 1 + x * 4
      if (pixels[at] !== 0 || pixels[at + 1] !== 0 || pixels[at + 2] !== 0) coloured.push([x, y])
    }
  }
  expect(coloured).toEqual([])
})
