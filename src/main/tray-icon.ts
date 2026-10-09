// The plumb bob for the macOS menu bar, drawn here as a PNG: Electron takes no SVG, and a template image is only
// black and alpha, which is all this draws. The shape is prumo-site's mark (src/features/site/brand.tsx there).
// No Electron here, so the tests read the PNG it makes.
import { deflateSync } from 'node:zlib'

const LINE = 6
const BOB = LINE + 4
/** The mark's own coordinates: 24 wide, the line, the cap, then the diamond. */
const VIEW = { width: 24, height: BOB + 36 }

function inside(x: number, y: number): boolean {
  // The string, 1.5 wide.
  if (y >= 0 && y <= LINE && Math.abs(x - 12) <= 0.75) return true
  // The cap the string ties to.
  if (x >= 9 && x <= 15 && y >= LINE && y <= BOB) return true
  // The bob: a diamond from (12, BOB) to (12, BOB + 36), widest at BOB + 12.
  if (y < BOB || y > BOB + 36) return false
  const half = y <= BOB + 12 ? ((y - BOB) / 12) * 10 : ((BOB + 36 - y) / 24) * 10
  return Math.abs(x - 12) <= half
}

let table: number[] | undefined

function crc32(bytes: Buffer): number {
  table ??= Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  let crc = 0xffffffff
  for (const byte of bytes) crc = (table[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** The mark `height` pixels tall, black on transparent, antialiased by sampling each pixel 4×4 times. */
export function plumbPng(height: number): { png: Buffer; width: number; height: number } {
  const scale = height / VIEW.height
  const width = Math.ceil(VIEW.width * scale)
  const rows: Buffer[] = []

  for (let py = 0; py < height; py++) {
    const row = Buffer.alloc(1 + width * 4) // filter byte 0, then RGBA, black
    for (let px = 0; px < width; px++) {
      let covered = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          if (inside((px + (sx + 0.5) / 4) / scale, (py + (sy + 0.5) / 4) / scale)) covered++
        }
      }
      row[1 + px * 4 + 3] = Math.round((covered / 16) * 255)
    }
    rows.push(row)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])

  return { png, width, height }
}
