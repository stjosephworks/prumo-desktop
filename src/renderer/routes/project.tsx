import { Link, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { PortAnswer, PortCheck, Project, RunningApp } from '../../shared/ipc.ts'
import { type Part, partId, partsFor } from '../../shared/parts.ts'
import { browserUrl } from '../../shared/urls.ts'
import { Database } from '../components/database.tsx'
import { Terminal } from '../components/terminal.tsx'
import { useAppOutput } from '../use-app-output.ts'
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

const ACTION = 'rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50'

type Refused = Extract<PortCheck, { ok: false }>

function PortBusy({
  refused,
  onAnswer,
  onCancel,
}: {
  refused: Refused
  onAnswer: (answer: PortAnswer) => void
  onCancel: () => void
}) {
  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      {/* The script's own words: it names the process, so nothing is stopped unnamed. */}
      <p className="text-amber-900">{refused.message}</p>
      {refused.code === 'port_busy' && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => onAnswer('kill')} className={ACTION}>
            Stop it
          </button>
          <button type="button" onClick={() => onAnswer('change')} className={ACTION}>
            Move this app
          </button>
          <button type="button" onClick={onCancel} className={ACTION}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function PartPanel({
  project,
  part,
  app,
  refused,
  onStart,
  onCancel,
}: {
  project: Project
  part: Part
  app?: RunningApp
  refused?: Refused
  onStart: (answer?: PortAnswer) => void
  onCancel: () => void
}) {
  const id = partId(project, part)
  const state = app?.state ?? 'stopped'
  const busy = state === 'running' || state === 'starting'
  // Only the apps that serve a page are watched for an address; mobile answers on a phone, not in a browser.
  const output = useAppOutput(id, busy && (part.type === 'web' || part.type === 'site'))
  const url = browserUrl(output)

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
        <div className="flex items-center gap-3">
          {/* The address comes from what the app printed, so a dev server that moved port still opens. */}
          {url !== undefined && (
            <button type="button" onClick={() => window.prumo.openExternal(url)} className={ACTION}>
              Open {url.replace(/^https?:\/\//, '')}
            </button>
          )}

          {/*
            Expo opens the simulators itself, through its own keyboard shortcuts, which only work while it runs.
            The Desktop presses the key instead of copying what Expo does behind it.
          */}
          {part.type === 'mobile' && busy && (
            <>
              <button
                type="button"
                onClick={() => window.prumo.apps.write(id, 'i')}
                className={ACTION}
              >
                iOS simulator
              </button>
              <button
                type="button"
                onClick={() => window.prumo.apps.write(id, 'a')}
                className={ACTION}
              >
                Android emulator
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => (busy ? window.prumo.apps.stop(id) : onStart())}
            className={ACTION}
          >
            {busy ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>

      {refused !== undefined && (
        <PortBusy refused={refused} onAnswer={(answer) => onStart(answer)} onCancel={onCancel} />
      )}

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
  const [refusals, setRefusals] = useState<Record<string, Refused>>({})
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

  const forget = (part: Part) => setRefusals(({ [part.script]: _, ...rest }) => rest)

  /**
   * The port first, then the app. A port in use comes back as a question beside the app instead of a prompt
   * waiting inside its terminal, where the app would already look like it is running.
   */
  const start = async (part: Part, answer?: PortAnswer) => {
    const check = await window.prumo.apps.checkPort(project, part.type, answer)

    if (!check.ok) {
      setRefusals((current) => ({ ...current, [part.script]: check }))
      return
    }

    forget(part)
    window.prumo.apps.start({ project: project.path, script: part.script })
  }

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
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to="/docs"
            search={{ path: project.path, doc: 'INDEX.md' }}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Conventions
          </Link>
          <button
            type="button"
            onClick={() => {
              // "Run all" starts each app separately: one mixed log cannot be stopped app by app.
              // An app already running holds its own port, so it is left out of the check.
              for (const part of parts) {
                if (!running.includes(part)) start(part)
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
          <PartPanel
            key={part.script}
            project={project}
            part={part}
            app={appOf(part)}
            refused={refusals[part.script]}
            onStart={(answer) => start(part, answer)}
            onCancel={() => forget(part)}
          />
        ))}
      </ul>

      <Database project={project} />
    </main>
  )
}
