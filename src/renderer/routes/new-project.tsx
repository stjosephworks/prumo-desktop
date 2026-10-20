import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Folder,
  Globe,
  KeyRound,
  type LucideIcon,
  Mail,
  Plus,
  Server,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { App, AppType, Project, ProjectConfig, SocialProvider } from '../../shared/ipc.ts'
import { typesOf } from '../../shared/parts.ts'
import {
  allowsAlone,
  asksEmail,
  asksMcp,
  asksSocial,
  asksTenancy,
  defaultApps,
  REPEATABLE,
  SOCIAL_PROVIDERS,
} from '../../shared/questions.ts'
import {
  Button,
  cx,
  INPUT,
  Label,
  LogBlock,
  Notice,
  PageHeader,
  ProgressBar,
  Section,
  Tag,
  TerminalToggle,
  useOutputPanel,
} from '../components/ui.tsx'
import { useT } from '../i18n/i18n.tsx'
import { refreshProjects } from '../use-projects.ts'

const TYPES: { value: AppType; icon: LucideIcon }[] = [
  { value: 'api', icon: Server },
  { value: 'web', icon: Globe },
  { value: 'mobile', icon: Smartphone },
  { value: 'site', icon: Globe },
]

const ICON = Object.fromEntries(TYPES.map((type) => [type.value, type.icon])) as Record<
  AppType,
  LucideIcon
>

/** A second web or site, added in the advanced options; the id keeps its row while its name is typed. */
type Extra = App & { id: number }

/**
 * Every app the project will have, by name: the types chosen, each renamed or not, then each one added. The names
 * are judged by `prumo new`, which answers `invalid_app` for one it refuses.
 */
function AppNames({
  apps,
  extras,
  onRename,
  onAdd,
  onRemove,
  problem,
}: {
  apps: App[]
  extras: Extra[]
  onRename: (index: number, name: string) => void
  onAdd: (type: AppType) => void
  onRemove: (id: number) => void
  problem?: string
}) {
  const t = useT()
  const firstExtra = apps.length - extras.length

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t.newProject.advancedHint}</p>
      <ul className="space-y-2">
        {apps.map((app, index) => {
          const Icon = ICON[app.type]
          const extra = index >= firstExtra ? extras[index - firstExtra] : undefined

          return (
            <li key={extra?.id ?? app.type} className="flex items-center gap-3">
              <Icon className="size-4 shrink-0 text-navy" />
              <span className="w-14 shrink-0">
                <Tag>{app.type}</Tag>
              </span>
              <input
                aria-label={t.newProject.appName(app.type)}
                value={app.name}
                onChange={(event) => onRename(index, event.target.value)}
                placeholder={app.type === 'site' ? 'blog' : 'backoffice'}
                className={`${INPUT} max-w-64 font-mono`}
              />
              {extra !== undefined && (
                <Button
                  variant="danger"
                  size="sm"
                  aria-label={t.newProject.removeApp}
                  onClick={() => onRemove(extra.id)}
                >
                  <X />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex gap-2">
        {REPEATABLE.map((type) => (
          <Button key={type} size="sm" onClick={() => onAdd(type)}>
            <Plus />
            {t.newProject.addApp(type)}
          </Button>
        ))}
      </div>
      {problem !== undefined && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  )
}

/** Two or three choices side by side, one of them chosen: a radio group dressed as a control. */
function Segmented<T extends string | boolean>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex rounded-md border border-rule bg-card p-0.5">
      {options.map((option) => (
        <label
          key={option.label}
          className={cx(
            'cursor-pointer rounded-sm px-3 py-1 text-sm transition-colors',
            value === option.value ? 'bg-navy text-card' : 'text-ink/75 hover:text-ink',
            option.disabled === true && 'pointer-events-none opacity-35',
          )}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint !== undefined && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** A yes-or-no question about a feature, as a card that is ticked. */
function Toggle({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: LucideIcon
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-start gap-3 rounded-md border bg-card p-4 transition-colors',
        checked ? 'border-brass bg-brass/[0.06]' : 'border-rule hover:border-brass',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      <span>
        <span className="flex items-center gap-1.5 font-serif font-semibold text-navy">
          <Icon className="size-3.5 text-brass-ink" />
          {title}
        </span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}

/**
 * Every question the CLI asks, as a form. The name is judged by `prumo new`, and its answer is shown beside the
 * field. Which questions apply to the chosen types follows the CLI (`src/shared/questions.ts`), so the form only
 * shows what the CLI would ask, and never sends a combination it refuses.
 */
export function NewProject() {
  const navigate = useNavigate()
  const t = useT()
  const [parent, setParent] = useState<string>()
  const [name, setName] = useState('')
  const [types, setTypes] = useState<AppType[]>(['api', 'web'])
  // The advanced options: closed, every app is named after its type, as the CLI names it by default.
  const [advanced, setAdvanced] = useState(false)
  const [names, setNames] = useState<Partial<Record<AppType, string>>>({})
  const [extras, setExtras] = useState<Extra[]>([])
  const nextExtra = useRef(0)
  const [architecture, setArchitecture] = useState<ProjectConfig['architecture']>('monorepo')
  const [multiTenant, setMultiTenant] = useState(false)
  const [mcp, setMcp] = useState(false)
  const [email, setEmail] = useState(false)
  const [social, setSocial] = useState<SocialProvider[]>([])
  // A project the CLI created with warnings: they are read here before going on, since the list would hide them.
  const [created, setCreated] = useState<{ project: Project; warnings: string[] }>()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<{ code: string; message: string }>()
  const [log, setLog] = useState('')
  const logEnd = useRef<HTMLDivElement>(null)

  useEffect(() => window.prumo.projects.onCreateLog((chunk) => setLog((all) => all + chunk)), [])
  // A creation that failed with output to read; a refused name or folder has none, and is shown beside its field.
  const failed = error !== undefined && log !== ''
  const [logOpen, toggleLog] = useOutputPanel(failed)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the log growing, or being opened, is what scrolls it.
  useEffect(() => logEnd.current?.scrollIntoView({ block: 'end' }), [log, logOpen])

  const named: App[] = [
    ...types.map((type) => ({ name: names[type] ?? type, type })),
    ...extras.map(({ name, type }) => ({ name, type })),
  ]
  // Several apps always make a workspace, whatever was picked while there was one. Names are a workspace's, so
  // alone, every app keeps its type's.
  const alonePossible = allowsAlone(advanced ? named : defaultApps(types))
  const shape = alonePossible ? architecture : 'monorepo'
  const apps = advanced && shape === 'monorepo' ? named : defaultApps(types)
  const chosen = typesOf(apps)
  const unnamed = apps.some((app) => app.name.trim() === '')

  const rename = (index: number, name: string) => {
    const type = types[index]

    if (type !== undefined) {
      setNames((current) => ({ ...current, [type]: name }))
      return
    }

    const id = extras[index - types.length]?.id
    setExtras((current) => current.map((extra) => (extra.id === id ? { ...extra, name } : extra)))
  }

  const addExtra = (type: AppType) => {
    nextExtra.current += 1
    setExtras((current) => [...current, { id: nextExtra.current, name: '', type }])
  }

  const toggle = (value: AppType) => {
    setTypes((current) =>
      current.includes(value) ? current.filter((one) => one !== value) : [...current, value],
    )
  }

  const toggleProvider = (provider: SocialProvider, on: boolean) => {
    setSocial((current) =>
      on ? [...current, provider] : current.filter((one) => one !== provider),
    )
  }

  const create = async () => {
    if (parent === undefined || name === '' || apps.length === 0 || unnamed) return

    setCreating(true)
    setError(undefined)
    setLog('')

    const result = await window.prumo.projects.create({
      parent,
      name,
      apps: apps.map((app) => ({ ...app, name: app.name.trim() })),
      architecture: shape,
      multiTenant: asksTenancy(chosen) && multiTenant,
      mcp: asksMcp(chosen) && mcp,
      email: asksEmail(chosen) && email,
      social: asksSocial(chosen) ? social : [],
    })

    setCreating(false)

    if (result.ok) {
      await refreshProjects()
      if (result.warnings.length > 0) {
        setCreated({ project: result.project, warnings: result.warnings })
        return
      }
      navigate({ to: '/' })
      return
    }

    setError({ code: result.code, message: result.message })
  }

  const fieldError = (code: string) => (error?.code === code ? error.message : undefined)

  return (
    <main className="mx-auto max-w-3xl px-10 pb-16">
      <PageHeader
        eyebrow="prumo new"
        title={t.nav.newProject}
        description={t.newProject.description}
      />

      <fieldset disabled={creating || created !== undefined} className="space-y-10">
        <Section title={t.newProject.where}>
          <div className="grid grid-cols-[1fr_1.2fr] gap-5">
            <Field
              label={t.newProject.name}
              hint={fieldError('invalid_input') === undefined && t.newProject.nameHint}
            >
              <input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="my-app"
                className={`${INPUT} font-mono`}
              />
              {/* The rule lives in the CLI; this is its answer, not a second copy of it. */}
              {fieldError('invalid_input') !== undefined && (
                <p className="mt-1.5 text-xs text-destructive">{fieldError('invalid_input')}</p>
              )}
            </Field>

            <Field label={t.newProject.folder}>
              <button
                type="button"
                onClick={async () => setParent(await window.prumo.projects.chooseParent())}
                className={`${INPUT} flex items-center gap-2 text-left hover:border-brass`}
              >
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                <span
                  className={cx(
                    'truncate font-mono text-xs',
                    parent === undefined && 'text-muted-foreground',
                  )}
                >
                  {parent === undefined ? t.newProject.chooseFolder : `${parent}/${name || '…'}`}
                </span>
              </button>
              {fieldError('target_not_empty') !== undefined && (
                <p className="mt-1.5 text-xs text-destructive">{fieldError('target_not_empty')}</p>
              )}
            </Field>
          </div>
        </Section>

        <Section title={t.newProject.what}>
          <div className="grid grid-cols-2 gap-3">
            {TYPES.map((type) => {
              const chosen = types.includes(type.value)
              const Icon = type.icon

              return (
                <label
                  key={type.value}
                  className={cx(
                    'relative flex cursor-pointer items-start gap-3 rounded-md border bg-card p-4 transition-colors',
                    chosen
                      ? 'border-navy shadow-[inset_0_0_0_1px_var(--navy)]'
                      : 'border-rule hover:border-brass',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={chosen}
                    onChange={() => toggle(type.value)}
                  />
                  <span
                    className={cx(
                      'flex size-8 shrink-0 items-center justify-center rounded-md border',
                      chosen ? 'border-navy bg-navy text-card' : 'border-rule bg-paper text-navy',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif font-semibold text-navy">{type.value}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.newProject.types[type.value]}
                    </span>
                  </span>
                  {chosen && <Check className="absolute right-3 top-3 size-4 text-brass-ink" />}
                </label>
              )
            })}
          </div>
        </Section>

        <Section title={t.newProject.shaped}>
          <div className="flex flex-wrap gap-x-10 gap-y-6">
            <Field
              label={t.newProject.shape}
              hint={alonePossible ? undefined : t.newProject.severalTypes}
            >
              <Segmented
                name="architecture"
                value={shape}
                onChange={setArchitecture}
                options={[
                  { value: 'alone', label: 'alone', disabled: !alonePossible },
                  { value: 'monorepo', label: 'monorepo' },
                ]}
              />
            </Field>

            {asksTenancy(chosen) && (
              <Field label={t.newProject.tenancy}>
                <Segmented
                  name="tenancy"
                  value={multiTenant}
                  onChange={setMultiTenant}
                  options={[
                    { value: false, label: 'single-tenant' },
                    { value: true, label: 'multi-tenant' },
                  ]}
                />
              </Field>
            )}
          </div>

          {(asksMcp(chosen) || asksEmail(chosen)) && (
            <div className="mt-6 space-y-3">
              {asksMcp(chosen) && (
                <Toggle
                  icon={Sparkles}
                  title="MCP"
                  description={t.newProject.mcp}
                  checked={mcp}
                  onChange={setMcp}
                />
              )}
              {asksEmail(chosen) && (
                <Toggle
                  icon={Mail}
                  title={t.newProject.emailTitle}
                  description={t.newProject.email}
                  checked={email}
                  onChange={setEmail}
                />
              )}
            </div>
          )}

          {asksSocial(chosen) && (
            <div className="mt-6">
              <Field label={t.newProject.socialTitle} hint={t.newProject.social}>
                <div className="flex flex-wrap gap-3">
                  {SOCIAL_PROVIDERS.map((provider) => (
                    <label
                      key={provider}
                      className={cx(
                        'flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm transition-colors',
                        social.includes(provider)
                          ? 'border-brass bg-brass/[0.06]'
                          : 'border-rule hover:border-brass',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={social.includes(provider)}
                        onChange={(event) => toggleProvider(provider, event.target.checked)}
                      />
                      <KeyRound className="size-3.5 text-brass-ink" />
                      {t.newProject.providers[provider]}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {shape === 'monorepo' && (
            <div className="mt-6 border-t border-rule pt-5">
              <button
                type="button"
                aria-expanded={advanced}
                onClick={() => setAdvanced((open) => !open)}
                className="flex items-center gap-1.5 text-sm font-medium text-navy hover:text-brass-ink"
              >
                <ChevronDown
                  className={cx('size-4 transition-transform', !advanced && '-rotate-90')}
                />
                {t.newProject.advanced}
              </button>
              {advanced && (
                <div className="mt-4">
                  <AppNames
                    apps={named}
                    extras={extras}
                    onRename={rename}
                    onAdd={addExtra}
                    onRemove={(id) =>
                      setExtras((current) => current.filter((extra) => extra.id !== id))
                    }
                    problem={fieldError('invalid_app')}
                  />
                </div>
              )}
            </div>
          )}
        </Section>
      </fieldset>

      <div className="mt-10 flex items-center gap-4 border-t border-rule pt-6">
        <Button
          variant="primary"
          onClick={create}
          disabled={
            creating ||
            created !== undefined ||
            parent === undefined ||
            name === '' ||
            apps.length === 0 ||
            unnamed
          }
          className="h-9 px-5"
        >
          {creating ? t.newProject.creating : t.newProject.create}
        </Button>
        {creating && (
          <span className="text-sm text-muted-foreground">{t.newProject.preparing}</span>
        )}
        {log !== '' && (
          <span className="ml-auto">
            <TerminalToggle open={logOpen} onToggle={toggleLog} failed={failed} />
          </span>
        )}
      </div>

      {creating && <ProgressBar label={t.newProject.creatingLabel} className="relative mt-4" />}

      {/* The CLI's own words: it judged these answers worth a warning, not a refusal. */}
      {created !== undefined && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-ink">
            {t.newProject.createdWithWarnings(created.project.name)}
          </p>
          {created.warnings.map((warning) => (
            <Notice key={warning} tone="warning" icon={<AlertTriangle className="text-warning" />}>
              {warning}
            </Notice>
          ))}
          <Button variant="primary" className="h-9 px-5" onClick={() => navigate({ to: '/' })}>
            {t.newProject.continue}
          </Button>
        </div>
      )}

      {/* An error the CLI did not tie to a field still has to be seen. */}
      {error !== undefined &&
        !['invalid_input', 'invalid_app', 'target_not_empty'].includes(error.code) && (
          <p className="mt-4 text-sm text-destructive">{error.message}</p>
        )}

      {log !== '' && logOpen && (
        <LogBlock className="mt-6 max-h-72">
          {log}
          <div ref={logEnd} />
        </LogBlock>
      )}
    </main>
  )
}
