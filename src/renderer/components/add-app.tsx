import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AppType, Project, WebFramework } from '../../shared/ipc.ts'
import { partsFor } from '../../shared/parts.ts'
import { REPEATABLE, WEB_FRAMEWORKS } from '../../shared/questions.ts'
import { useT } from '../i18n/i18n.tsx'
import { refreshProjects } from '../use-projects.ts'
import {
  Button,
  INPUT,
  Label,
  LogBlock,
  ProgressBar,
  TerminalToggle,
  useOutputPanel,
} from './ui.tsx'

const TYPES: AppType[] = ['api', 'web', 'mobile']

/**
 * `prumo add` for a workspace: a type, its framework when it is web, and a name when it is not the type's own. Which
 * types are offered follows the CLI's rule (web repeats, api and mobile only when missing); every other judgement, the name and the
 * version that may add to this project, is the CLI's, and its answer is shown here.
 */
export function AddApp({ project }: { project: Project }) {
  const t = useT()
  const parts = partsFor(project)
  const offered = TYPES.filter(
    (type) => REPEATABLE.includes(type) || !parts.some((part) => part.type === type),
  )
  const [open, setOpen] = useState(false)
  // web always repeats, so it is always offered.
  const [type, setType] = useState<AppType>('web')
  const [framework, setFramework] = useState<WebFramework>('vite')
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string>()
  const [log, setLog] = useState('')
  const logEnd = useRef<HTMLDivElement>(null)
  const failed = error !== undefined && log !== ''
  const [logOpen, toggleLog] = useOutputPanel(failed)

  useEffect(() => window.prumo.projects.onAddLog((chunk) => setLog((all) => all + chunk)), [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: the log growing, or being opened, is what scrolls it.
  useEffect(() => logEnd.current?.scrollIntoView({ block: 'end' }), [log, logOpen])

  const close = () => {
    setOpen(false)
    setType('web')
    setFramework('vite')
    setName('')
    setError(undefined)
    setLog('')
  }

  const add = async () => {
    setAdding(true)
    setError(undefined)
    setLog('')

    const trimmed = name.trim()
    const result = await window.prumo.projects.addApp(project.path, {
      type,
      ...(type === 'web' ? { framework } : {}),
      ...(trimmed === '' ? {} : { name: trimmed }),
    })

    setAdding(false)

    if (result.ok) {
      await refreshProjects()
      close()
      return
    }

    setError(result.message)
  }

  if (!open) {
    return (
      <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>
        <Plus />
        {t.project.addApp}
      </Button>
    )
  }

  return (
    <div className="relative mt-3 overflow-hidden rounded-md border border-rule bg-card p-5">
      <fieldset disabled={adding} className="flex flex-wrap items-end gap-4">
        <div>
          <Label>{t.project.addAppType}</Label>
          <select
            aria-label={t.project.addAppType}
            value={type}
            onChange={(event) => setType(event.target.value as AppType)}
            className={`${INPUT} w-32 font-mono`}
          >
            {offered.map((each) => (
              <option key={each} value={each}>
                {each}
              </option>
            ))}
          </select>
        </div>
        {type === 'web' && (
          <div>
            <Label>{t.project.addAppFramework}</Label>
            <select
              aria-label={t.project.addAppFramework}
              value={framework}
              onChange={(event) => setFramework(event.target.value as WebFramework)}
              className={`${INPUT} w-40`}
            >
              {WEB_FRAMEWORKS.map((each) => (
                <option key={each} value={each} title={t.newProject.frameworks[each].hint}>
                  {t.newProject.frameworks[each].label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="min-w-48 flex-1">
          <Label>{t.project.addAppName}</Label>
          <input
            aria-label={t.project.addAppName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={type}
            className={`${INPUT} font-mono`}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={add} disabled={adding}>
            {adding ? t.project.adding : t.project.addAppConfirm}
          </Button>
          <Button onClick={close} disabled={adding}>
            {t.common.cancel}
          </Button>
        </div>
      </fieldset>
      {type === 'web' && (
        <p className="mt-2 text-xs text-ink/75">{t.newProject.frameworks[framework].hint}.</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{t.project.addAppHint}</p>
      {error !== undefined && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {log !== '' && (
        <div className="mt-3">
          <TerminalToggle open={logOpen} onToggle={toggleLog} failed={failed} />
        </div>
      )}
      {log !== '' && logOpen && (
        <LogBlock className="mt-3 max-h-60">
          {log}
          <div ref={logEnd} />
        </LogBlock>
      )}
      {adding && (
        <ProgressBar label={t.project.addingLabel} className="absolute inset-x-0 bottom-0" />
      )}
    </div>
  )
}
