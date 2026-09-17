import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** A link inside a document, resolved against the document it came from. */
function resolveLink(from: string, href: string): string {
  const parts = [...from.split('/').slice(0, -1), ...href.split('/')]
  const stack: string[] = []

  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }

  return stack.join('/')
}

/**
 * The knowledge base, read only. Links between documents stay inside the app, links to the web go to the browser,
 * and anyone who wants to change a document opens it in their editor.
 */
export function Docs() {
  const { path, doc } = useSearch({ from: '/docs' })
  const navigate = useNavigate()
  const [text, setText] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    setText(undefined)
    setError(undefined)
    window.prumo.docs.read(path, doc).then((result) => {
      if (result.ok) setText(result.text)
      else setError(result.message)
    })
  }, [path, doc])

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="flex items-center justify-between">
        <Link
          to="/project"
          search={{ path }}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Project
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {doc !== 'INDEX.md' && (
            <Link
              to="/docs"
              search={{ path, doc: 'INDEX.md' }}
              className="text-neutral-500 hover:text-neutral-900"
            >
              Index
            </Link>
          )}
          <button
            type="button"
            onClick={() => window.prumo.docs.openInEditor(path, doc)}
            className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-50"
          >
            Open in editor
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-500">.prumo/{doc}</p>

      {error !== undefined && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {text !== undefined && (
        <article className="prose mt-6 max-w-none text-[15px] leading-relaxed">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                const target = href ?? ''

                if (/^https?:\/\//.test(target)) {
                  return (
                    <button
                      type="button"
                      className="text-blue-700 underline"
                      onClick={() => window.prumo.docs.openExternal(target)}
                    >
                      {children}
                    </button>
                  )
                }

                // A link between documents is navigation inside the app, not a page load.
                return (
                  <button
                    type="button"
                    className="text-blue-700 underline"
                    onClick={() =>
                      navigate({ to: '/docs', search: { path, doc: resolveLink(doc, target) } })
                    }
                  >
                    {children}
                  </button>
                )
              },
            }}
          >
            {text}
          </Markdown>
        </article>
      )}
    </main>
  )
}
