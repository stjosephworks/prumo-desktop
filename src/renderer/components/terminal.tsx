import '@xterm/xterm/css/xterm.css'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as Xterm } from '@xterm/xterm'
import { useEffect, useRef } from 'react'

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
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      theme: { background: '#171717' },
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

  return <div ref={host} className="h-72 overflow-hidden rounded-md bg-neutral-900 p-2" />
}
