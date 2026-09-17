import { useCallback, useEffect, useState } from 'react'
import type { Project } from '../../shared/ipc.ts'
import { EnvironmentBanner } from '../components/environment-banner.tsx'

/** What a project is, in one line: its shape, from its own `.prumo/config.json`. */
function Shape({ project }: { project: Project }) {
  if (project.config === undefined) return null

  const { types, architecture, multiTenant } = project.config

  return (
    <p className="mt-1 flex flex-wrap gap-1.5">
      {types.map((type) => (
        <span key={type} className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
          {type}
        </span>
      ))}
      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
        {architecture}
      </span>
      {multiTenant && (
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
          multi-tenant
        </span>
      )}
    </p>
  )
}

export function Projects() {
  const [projects, setProjects] = useState<Project[]>()
  const [error, setError] = useState<string>()

  const refresh = useCallback(() => {
    window.prumo.projects.list().then(setProjects)
  }, [])

  useEffect(refresh, [refresh])

  const add = async () => {
    setError(undefined)
    try {
      await window.prumo.projects.add()
      refresh()
    } catch (problem) {
      // The message comes from the main process, which checked for .prumo/config.json.
      setError(String(problem).replace(/^Error: .*?Error: /, ''))
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
        >
          Add folder
        </button>
      </header>

      <EnvironmentBanner />

      {error !== undefined && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {projects?.length === 0 && (
        <p className="mt-10 text-sm text-neutral-500">
          No projects yet. Add a folder that holds a <code>.prumo/config.json</code>.
        </p>
      )}

      <ul className="mt-6 divide-y divide-neutral-200">
        {projects?.map((project) => (
          <li key={project.path} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium">
                {project.name}
                {!project.found && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                    not found
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-neutral-500">{project.path}</p>
              <Shape project={project} />
            </div>
            <div className="flex shrink-0 gap-3 text-sm">
              {project.found && (
                <button
                  type="button"
                  onClick={() => window.prumo.projects.reveal(project.path)}
                  className="text-neutral-600 hover:text-neutral-900"
                >
                  Open
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await window.prumo.projects.remove(project.path)
                  refresh()
                }}
                className="text-neutral-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
