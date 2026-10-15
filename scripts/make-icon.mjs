// Renders build/icon.svg into the app icons Forge packages. Run it after changing the SVG:
//
//   build/icon.icns   macOS, through iconutil, so only on a Mac
//   build/icon.png    Linux: the deb and rpm desktop entries and the window icon, 512 pixels square
//   build/icon.ico    Windows: the exe, Setup.exe and the tray, every size Windows asks for, each a PNG inside
//
//   pnpm icon          (with ELECTRON_RUN_AS_NODE unset, or Electron runs the file as plain Node)
//
// Electron draws the SVG, so the icon needs no image tool beyond what the repository already installs; every size
// of the iconset is rasterised from the vector, not scaled down from the largest. iconutil ships with macOS.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

const root = join(import.meta.dirname, '..')
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf8')
/** The sizes Windows picks from, 16 to 256 pixels. */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

/**
 * An ICO holding one PNG per size, which Windows reads since Vista: a 6-byte header, a 16-byte entry per image
 * (a width or height of 0 meaning 256), then the images.
 */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16)
    entry[0] = size === 256 ? 0 : size
    entry[1] = size === 256 ? 0 : size
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    return entry
  })
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)])
}

// The names iconutil expects, each with its size in pixels.
const SIZES = [16, 32, 128, 256, 512].flatMap((size) => [
  [`icon_${size}x${size}.png`, size],
  [`icon_${size}x${size}@2x.png`, size * 2],
])

/** The SVG at `size` pixels, as PNG bytes, drawn on a canvas so the output is exactly that many pixels. */
async function render(window, size) {
  const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  const data = await window.webContents.executeJavaScript(`(async () => {
    const image = new Image(${size}, ${size})
    image.src = ${JSON.stringify(url)}
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = ${size}
    const context = canvas.getContext('2d')
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, ${size}, ${size})
    return canvas.toDataURL('image/png')
  })()`)

  return Buffer.from(data.split(',')[1], 'base64')
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false })
  await window.loadURL('about:blank')

  const work = mkdtempSync(join(tmpdir(), 'prumo-icon-'))
  const iconset = join(work, 'icon.iconset')
  mkdirSync(iconset)

  try {
    writeFileSync(join(root, 'build', 'icon.png'), await render(window, 512))
    console.log('Wrote build/icon.png')

    const images = []
    for (const size of ICO_SIZES) images.push({ size, png: await render(window, size) })
    writeFileSync(join(root, 'build', 'icon.ico'), ico(images))
    console.log('Wrote build/icon.ico')

    if (process.platform === 'darwin') {
      for (const [name, size] of SIZES)
        writeFileSync(join(iconset, name), await render(window, size))
      execFileSync('iconutil', [
        '--convert',
        'icns',
        '--output',
        join(root, 'build', 'icon.icns'),
        iconset,
      ])
      console.log('Wrote build/icon.icns')
    }
    // Optional: a preview at any size, e.g. `... make-icon.mjs --preview /tmp/icon.png 512`.
    const preview = process.argv.indexOf('--preview')
    if (preview !== -1) {
      const [path, size] = process.argv.slice(preview + 1)
      writeFileSync(path, await render(window, Number(size ?? 512)))
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
    app.quit()
  }
})
