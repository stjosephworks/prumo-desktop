import '@xterm/xterm/css/xterm.css'
import { FitAddon } from '@xterm/addon-fit'
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'

declare global {
  interface Window {
    spike: {
      ready: () => Promise<Record<string, string>>
      router: (info: unknown) => Promise<void>
      onPty: (listener: (app: string, data: string) => void) => void
    }
  }
}

function Home() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate({ to: '/terminal' })
  }, [navigate])
  return <p>home</p>
}

function TerminalPage() {
  const element = useRef<HTMLDivElement>(null)
  const location = useRouterState({ select: (state) => state.location.pathname })

  useEffect(() => {
    window.spike.router({ href: window.location.href, pathname: location, protocol: window.location.protocol })
  }, [location])

  useEffect(() => {
    if (element.current === null) return
    const term = new Terminal({ cols: 110, rows: 45, fontSize: 11 })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(element.current)
    window.spike.onPty((app, data) => {
      if (app === 'mobile') term.write(data)
    })
    window.spike.ready().then((buffers) => {
      if (buffers.mobile) term.write(buffers.mobile)
    })
    return () => term.dispose()
  }, [])

  return (
    <div style={{ padding: 8 }}>
      <div style={{ fontSize: 12, marginBottom: 6 }}>route: {location} — mobile terminal</div>
      <div ref={element} />
    </div>
  )
}

const root = createRootRoute({ component: Outlet })
const router = createRouter({
  history: createHashHistory(),
  routeTree: root.addChildren([
    createRoute({ getParentRoute: () => root, path: '/', component: Home }),
    createRoute({ getParentRoute: () => root, path: '/terminal', component: TerminalPage }),
  ]),
})

createRoot(document.getElementById('root') as HTMLElement).render(<RouterProvider router={router} />)
