import { Link } from '@tanstack/react-router'
import { ArrowUpRight, FolderPlus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Project, RunningApp } from '../../shared/ipc.ts'
import { partId, partsFor } from '../../shared/parts.ts'
import { PlumbMark } from '../components/brand.tsx'
import { CliUpdate } from '../components/cli-update.tsx'
import { EnvironmentBanner } from '../components/environment-banner.tsx'
import { GitBadge } from '../components/git-badge.tsx'
import { Button, buttonClass, PageHeader, StatusDot, Tag } from '../components/ui.tsx'
import { useT } from '../i18n/i18n.tsx'
import { useApps } from '../use-apps.ts'
import { refreshProjects, useProjects } from '../use-projects.ts'

/** What a project is, in one line: its shape, from its own `.prumo/config.json`. */
function Shape({ project }: { project: Project }) {
  if (project.config === undefined) return null

  const { types, architecture, multiTenant, mcp } = project.config

  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map((type) => (
        <Tag key={type}>{type}</Tag>
      ))}
      <Tag>{architecture}</Tag>
      {multiTenant && <Tag>multi-tenant</Tag>}
      {mcp && <Tag tone="brass">MCP</Tag>}
    </div>
  )
}

/** The summary a project shows in the list, counted from the apps the Desktop started. */
function Running({ project, apps }: { project: Project; apps: RunningApp[] }) {
  const t = useT()
  const parts = partsFor(project)

  if (parts.length === 0) return null

  const running = parts.filter((part) => {
    const state = apps.find((one) => one.id === partId(project, part))?.state
    return state === 'running' || state === 'starting'
  })

  if (running.length === 0) return null

  return (
    <span className="flex items-center gap-1.5 text-xs text-success">
      <StatusDot state="running" />
      {t.projects.running(running.length, parts.length)}
    </span>
  )
}

function Empty() {
  const t = useT()

  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-rule bg-card/60 px-8 py-16 text-center">
      <PlumbMark className="h-16 w-auto opacity-80" lineLength={22} />
      <h2 className="mt-5 font-serif text-xl font-semibold text-navy">{t.projects.emptyTitle}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {t.projects.emptyBefore}{' '}
        <code className="font-mono text-[0.8rem] text-ink">.prumo/config.json</code>.
      </p>
      <Link to="/new" className={`${buttonClass('primary')} mt-6`}>
        <Plus />
        {t.nav.newProject}
      </Link>
    </div>
  )
}

export function Projects() {
  const projects = useProjects()
  const [error, setError] = useState<string>()
  const apps = useApps()
  const t = useT()

  const add = async () => {
    setError(undefined)
    try {
      await window.prumo.projects.add()
      await refreshProjects()
    } catch (problem) {
      // The message comes from the main process, which checked for .prumo/config.json.
      setError(String(problem).replace(/^Error: .*?Error: /, ''))
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-10 pb-16">
      <PageHeader
        eyebrow={t.projects.eyebrow}
        title={t.nav.projects}
        description={t.projects.description}
        actions={
          <>
            <Button onClick={add}>
              <FolderPlus />
              {t.projects.addFolder}
            </Button>
            <Link to="/new" className={buttonClass('primary')}>
              <Plus />
              {t.nav.newProject}
            </Link>
          </>
        }
      />

      <div className="space-y-3">
        <EnvironmentBanner />
        <CliUpdate />
        {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="mt-6">
        {projects?.length === 0 && <Empty />}

        {projects !== undefined && projects.length > 0 && (
          <ul className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-card">
            {projects.map((project) => (
              <li
                key={project.path}
                className="group relative flex items-center gap-5 px-5 py-4 transition-colors hover:bg-paper/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    {project.found ? (
                      <Link
                        to="/project"
                        search={{ path: project.path }}
                        className="font-serif text-[1.05rem] font-semibold text-navy after:absolute after:inset-0 hover:underline hover:decoration-brass hover:underline-offset-4"
                      >
                        {project.name}
                      </Link>
                    ) : (
                      <span className="font-serif text-[1.05rem] font-semibold text-muted-foreground">
                        {project.name}
                      </span>
                    )}
                    {!project.found && <Tag tone="warning">{t.projects.notFound}</Tag>}
                    <Running project={project} apps={apps} />
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-3">
                    <p className="truncate font-mono text-[0.72rem] text-muted-foreground">
                      {project.path}
                    </p>
                    {project.found && <GitBadge path={project.path} />}
                  </div>
                  <div className="mt-2.5">
                    <Shape project={project} />
                  </div>
                </div>

                {/* Above the row's link, so each button still gets its own click. */}
                <div className="relative z-10 flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                  {project.found && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.prumo.projects.reveal(project.path)}
                    >
                      <ArrowUpRight />
                      {t.projects.open}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      await window.prumo.projects.remove(project.path)
                      await refreshProjects()
                    }}
                  >
                    <Trash2 />
                    {t.projects.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
