import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { Environment } from './routes/environment.tsx'
import { Projects } from './routes/projects.tsx'

const root = createRootRoute({ component: Outlet })

const routeTree = root.addChildren([
  createRoute({ getParentRoute: () => root, path: '/', component: Projects }),
  createRoute({ getParentRoute: () => root, path: '/environment', component: Environment }),
])

// A packaged renderer is loaded from file://, where a path-based history has no server to answer it.
export const router = createRouter({ routeTree, history: createHashHistory() })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
