import '@xterm/xterm/css/xterm.css'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as Xterm } from '@xterm/xterm'
import { useEffect, useRef } from 'react'

// xterm takes hex, not oklch: the site's ink, paper and brass, converted, with the ANSI colours kept readable on ink.
const THEME = {
  background: '#112439',
  foreground: '#dfe5ec',
  cursor: '#ac8950',
  cursorAccent: '#112439',
  selectionBackground: '#ac895055',
  black: '#0a192a',
  red: '#e0826f',
  green: '#7fc2a0',
  yellow: '#d9b779',
  blue: '#86aee0',
  magenta: '#c5a0d8',
  cyan: '#7cc4cf',
  white: '#dfe5ec',
  brightBlack: '#5a6673',
  brightRed: '#f09a88',
  brightGreen: '#98d6b5',
  brightYellow: '#ead08f',
  brightBlue: '#a2c4ef',
  brightMagenta: '#d7b7e6',
  brightCyan: '#98d7e0',
  brightWhite: '#f1f4f7',
}

/**
 * One app's terminal. It is a real terminal, not a log: Expo draws its QR code and its shortcuts here, colours
 * survive, and what the user types reaches the process, which is how a question asked by `pnpm dev` is answered.
 */
export function Terminal({ id }: { id: string }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (host.current === null) return

    const terminal = new Xterm({
      fontSize: 12,
      lineHeight: 1.25,
      fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
      theme: THEME,
      convertEol: true,
      scrollback: 5000,
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(host.current)
    fit.fit()

    // Everything written before this panel existed, so reopening a screen does not lose the output.
    window.prumo.apps.buffer(id).then((buffer) => {
      if (buffer !== '') terminal.write(buffer)
    })

    const stopOutput = window.prumo.apps.onOutput((appId, data) => {
      if (appId === id) terminal.write(data)
    })
    const typed = terminal.onData((data) => window.prumo.apps.write(id, data))

    const resize = new ResizeObserver(() => {
      fit.fit()
      window.prumo.apps.resize(id, terminal.cols, terminal.rows)
    })
    resize.observe(host.current)

    return () => {
      stopOutput()
      typed.dispose()
      resize.disconnect()
      terminal.dispose()
    }
  }, [id])

  return <div ref={host} className="h-72 overflow-hidden bg-ink px-3 py-2.5" />
}
