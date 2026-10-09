import { useEffect, useState } from 'react'
import type { Project } from '../shared/ipc.ts'

// The sidebar and the screens show the same list; one refresh reaches all of them.
const listeners = new Set<(projects: Project[]) => void>()

/** Reads the list again, after anything that changed it: adding, removing or creating a project. */
export async function refreshProjects(): Promise<void> {
  const projects = await window.prumo.projects.list()
  for (const listener of listeners) listener(projects)
}

/** The projects the Desktop keeps, undefined until the first read. */
export function useProjects(): Project[] | undefined {
  const [projects, setProjects] = useState<Project[]>()

  useEffect(() => {
    listeners.add(setProjects)
    window.prumo.projects.list().then(setProjects)

    return () => {
      listeners.delete(setProjects)
    }
  }, [])

  return projects
}
