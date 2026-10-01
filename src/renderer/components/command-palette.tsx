import { useNavigate } from '@tanstack/react-router'
import { FolderOpen, Gauge, LayoutGrid, Play, Plus, Search, Square } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { partId, partsFor } from '../../shared/parts.ts'
import { useApps } from '../use-apps.ts'
import { useProjects } from '../use-projects.ts'
import { cx } from './ui.tsx'

type Command = { id: string; label: string; hint?: string; icon: ReactNode; run: () => void }

/**
 * ⌘K, from anywhere: the screens, every project, and running or stopping its apps. Arrows move, Enter runs,
 * Escape closes. Starting goes through the main process's port check, as the menu bar does.
 */
export function CommandPalette() {
  const navigate = useNavigate()
  const projects = useProjects()
  const apps = useApps()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(0)
    input.current?.focus()
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const running = apps.filter((one) => one.state === 'running' || one.state === 'starting')
    const screens: Command[] = [
      { id: 'projects', label: 'Projects', icon: <LayoutGrid />, run: () => navigate({ to: '/' }) },
      { id: 'new', label: 'New project', icon: <Plus />, run: () => navigate({ to: '/new' }) },
      {
        id: 'machine',
        label: 'This machine',
        icon: <Gauge />,
        run: () => navigate({ to: '/environment' }),
      },
    ]
    const perProject = (projects ?? [])
      .filter((project) => project.found)
      .flatMap((project): Command[] => {
        const parts = partsFor(project)
        const stopped = parts.filter(
          (part) => !running.some((one) => one.id === partId(project, part)),
        )
        return [
          {
            id: `open:${project.path}`,
            label: project.name,
            hint: 'Open project',
            icon: <FolderOpen />,
            run: () => navigate({ to: '/project', search: { path: project.path } }),
          },
          ...(stopped.length > 0
            ? [
                {
                  id: `run:${project.path}`,
                  label: `Run all apps in ${project.name}`,
                  hint: stopped.map((part) => part.type).join(', '),
                  icon: <Play />,
                  run: () => {
                    navigate({ to: '/project', search: { path: project.path } })
                    for (const part of stopped) {
                      window.prumo.apps.checkPort(project, part.type).then((check) => {
                        if (check.ok) {
                          window.prumo.apps.start({
                            project: project.path,
                            script: part.script,
                            port: check.port,
                          })
                        }
                      })
                    }
                  },
                },
              ]
            : []),
        ]
      })
    const stopAll: Command[] =
      running.length > 0
        ? [
            {
              id: 'stop-all',
              label: 'Stop everything',
              hint: `${running.length} running`,
              icon: <Square />,
              run: () => {
                for (const one of running) window.prumo.apps.stop(one.id)
              },
            },
          ]
        : []

    return [...screens, ...perProject, ...stopAll]
  }, [apps, projects, navigate])

  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = commands.filter((command) =>
    words.every((word) => `${command.label} ${command.hint ?? ''}`.toLowerCase().includes(word)),
  )
  const active = Math.min(selected, Math.max(shown.length - 1, 0))

  if (!open) return null

  const run = (command: Command | undefined) => {
    if (command === undefined) return
    setOpen(false)
    command.run()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
      {/* The dimmed backdrop is the close button: a click outside the list closes it. */}
      <button
        type="button"
        aria-label="Close commands"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-label="Commands"
        className="relative w-full max-w-lg overflow-hidden rounded-md border border-rule bg-card shadow-2xl shadow-ink/20"
      >
        <div className="flex items-center gap-2.5 border-b border-rule px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelected(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelected((active + 1) % Math.max(shown.length, 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelected((active - 1 + shown.length) % Math.max(shown.length, 1))
              }
              if (event.key === 'Enter') run(shown[active])
            }}
            placeholder="Go to a project, or run its apps…"
            className="h-12 flex-1 bg-transparent text-sm text-ink placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <kbd className="rounded-sm border border-rule px-1.5 font-mono text-[0.65rem] text-muted-foreground">
            esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {shown.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing matches.
            </li>
          )}
          {shown.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                onMouseMove={() => setSelected(index)}
                onClick={() => run(command)}
                className={cx(
                  'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm [&_svg]:size-4 [&_svg]:shrink-0',
                  index === active ? 'bg-navy text-card' : 'text-ink',
                )}
              >
                <span className={index === active ? 'text-card/80' : 'text-muted-foreground'}>
                  {command.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                {command.hint !== undefined && (
                  <span
                    className={cx(
                      'shrink-0 text-xs',
                      index === active ? 'text-card/70' : 'text-muted-foreground',
                    )}
                  >
                    {command.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
