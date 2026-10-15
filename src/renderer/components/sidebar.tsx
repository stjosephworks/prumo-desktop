import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronDown, FolderOpen, Gauge, LayoutGrid, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { isLocale, LOCALES } from '../../shared/locales.ts'
import { partId, partsFor } from '../../shared/parts.ts'
import { useLocale, useT } from '../i18n/i18n.tsx'
import { useApps } from '../use-apps.ts'
import { useProjects } from '../use-projects.ts'
import { Wordmark } from './brand.tsx'
import { cx, StatusDot } from './ui.tsx'
import { UpdateNotice } from './update-notice.tsx'

function NavItem({
  to,
  icon,
  active,
  children,
}: {
  to: string
  icon: ReactNode
  active: boolean
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={cx(
        'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm [&_svg]:size-4',
        active
          ? 'bg-card text-navy shadow-[inset_2px_0_0_var(--brass)]'
          : 'text-ink/75 hover:bg-card/60 hover:text-ink',
      )}
    >
      {icon}
      {children}
    </Link>
  )
}

/**
 * The language, as a native select: the keyboard, focus and screen readers come with it. Each language is listed by
 * its own name, marked with its own `lang` so a screen reader says it in that language. The choice is kept by the
 * main process, and the window, the tray and the menu change at once.
 */
function LanguageSelect() {
  const t = useT()
  const { locale, setLocale } = useLocale()

  return (
    <div className="flex items-center justify-between gap-3 border-t border-rule px-5 py-3">
      <label
        htmlFor="language"
        className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {t.nav.language}
      </label>
      <div className="relative">
        <select
          id="language"
          value={locale}
          onChange={(event) => {
            if (isLocale(event.target.value)) setLocale(event.target.value)
          }}
          className="h-7 appearance-none rounded-sm border border-rule bg-card pr-7 pl-2 text-xs text-ink hover:border-brass focus:border-brass"
        >
          {LOCALES.map((one) => (
            <option key={one.code} value={one.code} lang={one.tag}>
              {one.name}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  )
}

/**
 * The window's left edge: where the traffic lights sit on macOS (its top is what moves the window), the wordmark, the
 * screens, and every project with a dot when one of its apps runs.
 */
export function Sidebar() {
  const t = useT()
  const location = useRouterState({ select: (state) => state.location })
  const projects = useProjects()
  const apps = useApps()
  const openPath =
    location.pathname === '/project' || location.pathname === '/docs'
      ? (location.search as { path?: string }).path
      : undefined

  const runningIn = (path: string) => {
    const project = projects?.find((one) => one.path === path)
    if (project === undefined) return 0
    return partsFor(project).filter((part) => {
      const state = apps.find((one) => one.id === partId(project, part))?.state
      return state === 'running' || state === 'starting'
    }).length
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-rule bg-muted/50">
      {/* Room for the traffic lights on macOS, and the part of the window a user grabs to move it. Elsewhere the
          window's controls sit at the top right, over the strip above the content, which this lines up with. */}
      <div
        className={cx('drag-region shrink-0', window.prumo.platform === 'darwin' ? 'h-12' : 'h-10')}
      />

      <div className="px-5 pb-6">
        <Wordmark />
      </div>

      <nav className="space-y-0.5 px-3">
        <NavItem to="/" icon={<LayoutGrid />} active={location.pathname === '/'}>
          {t.nav.projects}
        </NavItem>
        <NavItem to="/new" icon={<Plus />} active={location.pathname === '/new'}>
          {t.nav.newProject}
        </NavItem>
        <NavItem to="/environment" icon={<Gauge />} active={location.pathname === '/environment'}>
          {t.nav.thisMachine}
        </NavItem>
      </nav>

      <div className="mt-7 flex min-h-0 flex-1 flex-col">
        <p className="px-5 pb-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
          {t.nav.openAProject}
        </p>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {projects
            ?.filter((project) => project.found)
            .map((project) => {
              const running = runningIn(project.path)
              const active = openPath === project.path

              return (
                <li key={project.path}>
                  <Link
                    to="/project"
                    search={{ path: project.path }}
                    className={cx(
                      'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm',
                      active
                        ? 'bg-card text-navy shadow-[inset_2px_0_0_var(--brass)]'
                        : 'text-ink/75 hover:bg-card/60 hover:text-ink',
                    )}
                  >
                    <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {running > 0 && <StatusDot state="running" />}
                  </Link>
                </li>
              )
            })}
          {projects?.every((project) => !project.found) && (
            <li className="px-2.5 text-xs text-muted-foreground">{t.nav.noneYet}</li>
          )}
        </ul>
      </div>

      <UpdateNotice />
      <LanguageSelect />
    </aside>
  )
}
