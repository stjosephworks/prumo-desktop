import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { Docs } from './routes/docs.tsx'
import { Environment } from './routes/environment.tsx'
import { NewProject } from './routes/new-project.tsx'
import { ProjectScreen } from './routes/project.tsx'
import { Projects } from './routes/projects.tsx'

/**
 * The window has no title bar (`titleBarStyle: 'hiddenInset'`), so this strip is what the user grabs to move it,
 * and double-clicks to zoom it. It is opaque: content scrolled beneath it would look clickable and not be.
 */
function Layout() {
  return (
    <>
      <div className="drag-region fixed inset-x-0 top-0 z-10 h-10 bg-white" />
      <Outlet />
    </>
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
