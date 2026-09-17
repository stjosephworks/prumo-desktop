import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { ProjectConfig } from '../../shared/ipc.ts'

const TYPES: { value: ProjectConfig['types'][number]; label: string }[] = [
  { value: 'api', label: 'api' },
  { value: 'web', label: 'web' },
  { value: 'mobile', label: 'mobile' },
  { value: 'site', label: 'site' },
]

/**
 * Every question the CLI asks, as a form. The Desktop keeps no copy of the rules: the name is judged by
 * `prumo new`, and its answer is shown beside the field it belongs to.
 */
export function NewProject() {
  const navigate = useNavigate()
  const [parent, setParent] = useState<string>()
  const [name, setName] = useState('')
  const [types, setTypes] = useState<ProjectConfig['types']>(['api', 'web'])
  const [architecture, setArchitecture] = useState<ProjectConfig['architecture']>('monorepo')
  const [multiTenant, setMultiTenant] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<{ code: string; message: string }>()
  const [log, setLog] = useState('')
  const logEnd = useRef<HTMLDivElement>(null)

  useEffect(() => window.prumo.projects.onCreateLog((chunk) => setLog((all) => all + chunk)), [])
  useEffect(() => logEnd.current?.scrollIntoView({ block: 'end' }), [])

  const toggle = (value: ProjectConfig['types'][number]) => {
    setTypes((current) =>
      current.includes(value) ? current.filter((one) => one !== value) : [...current, value],
    )
  }

  const create = async () => {
    if (parent === undefined || name === '' || types.length === 0) return

    setCreating(true)
    setError(undefined)
    setLog('')

    const result = await window.prumo.projects.create({
      parent,
      name,
      types,
      architecture,
      multiTenant,
    })

    setCreating(false)

    if (result.ok) {
      navigate({ to: '/' })
      return
    }

    setError({ code: result.code, message: result.message })
  }

  const fieldError = (code: string) => (error?.code === code ? error.message : undefined)

  return (
    <main className="mx-auto max-w-2xl px-8 py-12">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Projects
      </Link>
      <h1 className="mt-4 text-xl font-semibold">New project</h1>

      <fieldset disabled={creating} className="mt-8 space-y-6">
        <div>
          <span className="text-sm font-medium">Where</span>
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={async () => setParent(await window.prumo.projects.chooseParent())}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Choose folder
            </button>
            <span className="truncate text-xs text-neutral-500">
              {parent ?? 'No folder chosen'}
            </span>
          </div>
          {fieldError('target_not_empty') !== undefined && (
            <p className="mt-1 text-sm text-red-600">{fieldError('target_not_empty')}</p>
          )}
        </div>

        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="my-app"
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          {/* The rule lives in the CLI; this is its answer, not a second copy of it. */}
          {fieldError('invalid_input') !== undefined && (
            <p className="mt-1 text-sm text-red-600">{fieldError('invalid_input')}</p>
          )}
        </div>

        <div>
          <span className="text-sm font-medium">What it has</span>
          <div className="mt-1 flex gap-4">
            {TYPES.map((type) => (
              <label key={type.value} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={types.includes(type.value)}
                  onChange={() => toggle(type.value)}
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-8">
          <div>
            <span className="text-sm font-medium">Shape</span>
            <div className="mt-1 flex gap-4">
              {(['alone', 'monorepo'] as const).map((value) => (
                <label key={value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="architecture"
                    checked={architecture === value}
                    onChange={() => setArchitecture(value)}
                  />
                  {value}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium">Tenancy</span>
            <div className="mt-1 flex gap-4">
              {[
                { value: false, label: 'single-tenant' },
                { value: true, label: 'multi-tenant' },
              ].map((option) => (
                <label key={option.label} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="tenancy"
                    checked={multiTenant === option.value}
                    onChange={() => setMultiTenant(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={create}
          disabled={creating || parent === undefined || name === '' || types.length === 0}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
        {creating && (
          <span className="text-sm text-neutral-500">
            Installing dependencies; this takes a while.
          </span>
        )}
      </div>

      {/* An error the CLI did not tie to a field still has to be seen. */}
      {error !== undefined && !['invalid_input', 'target_not_empty'].includes(error.code) && (
        <p className="mt-4 text-sm text-red-600">{error.message}</p>
      )}

      {log !== '' && (
        <pre className="mt-6 max-h-72 overflow-auto rounded-md bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-200">
          {log}
          <div ref={logEnd} />
        </pre>
      )}
    </main>
  )
}
