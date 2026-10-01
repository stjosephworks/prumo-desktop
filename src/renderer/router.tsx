import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { CommandPalette } from './components/command-palette.tsx'
import { Sidebar } from './components/sidebar.tsx'
import { Docs } from './routes/docs.tsx'
import { Environment } from './routes/environment.tsx'
import { NewProject } from './routes/new-project.tsx'
import { ProjectScreen } from './routes/project.tsx'
import { Projects } from './routes/projects.tsx'

/**
 * The window has no title bar (`titleBarStyle: 'hiddenInset'`): the top of the sidebar and the strip above the
 * content are what the user grabs to move it, and double-clicks to zoom it. The strip is opaque, because content
 * scrolled beneath it would look clickable and not be.
 */
function Layout() {
  const navigate = useNavigate()

  // A notification about a project was clicked: the main process brought the window back, this shows the project.
  useEffect(
    () => window.prumo.onNavigate((path) => navigate({ to: '/project', search: { path } })),
    [navigate],
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <CommandPalette />
      <div className="relative min-w-0 flex-1 overflow-y-auto">
        <div className="drag-region sticky top-0 z-10 h-10 bg-paper/90 backdrop-blur-sm" />
        <Outlet />
      </div>
    </div>
  )
}

const root = createRootRoute({ component: Layout })

const routeTree = root.addChildren([
  createRoute({ getParentRoute: () => root, path: '/', component: Projects }),
  createRoute({ getParentRoute: () => root, path: '/environment', component: Environment }),
  createRoute({ getParentRoute: () => root, path: '/new', component: NewProject }),
  createRoute({
    getParentRoute: () => root,
    path: '/docs',
    component: Docs,
    validateSearch: (search: Record<string, unknown>) => ({
      path: String(search.path ?? ''),
      doc: String(search.doc ?? 'INDEX.md'),
    }),
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/project',
    component: ProjectScreen,
    // A project is addressed by its path, which is a path itself: it belongs in the search, not in the route.
    validateSearch: (search: Record<string, unknown>) => ({ path: String(search.path ?? '') }),
  }),
])

// A packaged renderer is loaded from file://, where a path-based history has no server to answer it.
export const router = createRouter({ routeTree, history: createHashHistory() })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
