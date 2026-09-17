import { Link, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { Project, RunningApp } from '../../shared/ipc.ts'
import { type Part, partId, partsFor } from '../../shared/parts.ts'
import { Database } from '../components/database.tsx'
import { Terminal } from '../components/terminal.tsx'
import { useApps } from '../use-apps.ts'

const STATE_LABEL: Record<RunningApp['state'], string> = {
  starting: 'starting',
  running: 'running',
  stopped: 'stopped',
  failed: 'failed',
}

const STATE_COLOUR: Record<RunningApp['state'], string> = {
  starting: 'bg-amber-400',
  running: 'bg-emerald-500',
  stopped: 'bg-neutral-300',
  failed: 'bg-red-500',
}

function PartPanel({ project, part, app }: { project: Project; part: Part; app?: RunningApp }) {
  const id = partId(project, part)
  const state = app?.state ?? 'stopped'
  const busy = state === 'running' || state === 'starting'

  return (
    <li className="py-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`size-2 rounded-full ${STATE_COLOUR[state]}`} />
          <span className="font-medium">{part.type}</span>
          <span className="text-xs text-neutral-500">
            pnpm {part.script} — {STATE_LABEL[state]}
            {state === 'failed' && app?.exitCode !== undefined && ` (exit ${app.exitCode})`}
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            busy
              ? window.prumo.apps.stop(id)
              : window.prumo.apps.start({ project: project.path, script: part.script })
          }
          className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
        >
          {busy ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* The panel exists once an app has run: its log is worth reading after a failure too. */}
      {app !== undefined && (
        <div className="mt-3">
          <Terminal id={id} />
        </div>
      )}
    </li>
  )
}

export function ProjectScreen() {
  const { path } = useSearch({ from: '/project' })
  const [project, setProject] = useState<Project>()
  const apps = useApps()

  useEffect(() => {
    window.prumo.projects.list().then((all) => setProject(all.find((one) => one.path === path)))
  }, [path])

  if (project === undefined) {
    return (
      <main className="mx-auto max-w-3xl px-8 py-12">
        <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Projects
        </Link>
        <p className="mt-6 text-sm text-neutral-500">This project is no longer in the list.</p>
      </main>
    )
  }

  const parts = partsFor(project)
  const appOf = (part: Part) => apps.find((one) => one.id === partId(project, part))
  const running = parts.filter((part) => {
    const state = appOf(part)?.state
    return state === 'running' || state === 'starting'
  })

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Projects
      </Link>

      <header className="mt-4 flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <p className="truncate text-xs text-neutral-500">{project.path}</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => {
              // "Run all" starts each app separately: one mixed log cannot be stopped app by app.
              for (const part of parts) {
                window.prumo.apps.start({ project: project.path, script: part.script })
              }
            }}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
          >
            Run all
          </button>
          {running.length > 0 && (
            <button
              type="button"
              onClick={() => {
                for (const part of parts) window.prumo.apps.stop(partId(project, part))
              }}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Stop all
            </button>
          )}
        </div>
      </header>

      <p className="mt-4 text-sm text-neutral-500">
        {running.length} of {parts.length} running
      </p>

      <ul className="mt-2 divide-y divide-neutral-200">
        {parts.map((part) => (
          <PartPanel key={part.script} project={project} part={part} app={appOf(part)} />
        ))}
      </ul>

      <Database project={project} />
    </main>
  )
}
