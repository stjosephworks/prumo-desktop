import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { Environment } from './routes/environment.tsx'
import { NewProject } from './routes/new-project.tsx'
import { ProjectScreen } from './routes/project.tsx'
import { Projects } from './routes/projects.tsx'

const root = createRootRoute({ component: Outlet })

const routeTree = root.addChildren([
  createRoute({ getParentRoute: () => root, path: '/', component: Projects }),
  createRoute({ getParentRoute: () => root, path: '/environment', component: Environment }),
  createRoute({ getParentRoute: () => root, path: '/new', component: NewProject }),
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
