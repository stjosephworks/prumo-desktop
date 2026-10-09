import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { SquarePen } from 'lucide-react'
import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '../components/ui.tsx'
import { useT } from '../i18n/i18n.tsx'

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
  const t = useT()
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

  const project = path.split('/').at(-1)

  return (
    <main className="mx-auto max-w-3xl px-10 pb-16">
      <div className="flex items-center justify-between gap-4 border-b border-rule pb-4">
        <nav className="flex min-w-0 items-center gap-1.5 font-mono text-[0.72rem] text-muted-foreground">
          <Link to="/project" search={{ path }} className="hover:text-navy">
            {project}
          </Link>
          <span>/</span>
          <Link to="/docs" search={{ path, doc: 'INDEX.md' }} className="hover:text-navy">
            .prumo
          </Link>
          {doc !== 'INDEX.md' && (
            <>
              <span>/</span>
              <span className="truncate text-ink">{doc}</span>
            </>
          )}
        </nav>
        <Button size="sm" onClick={() => window.prumo.docs.openInEditor(path, doc)}>
          <SquarePen />
          {t.docs.openInEditor}
        </Button>
      </div>

      {error !== undefined && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {text !== undefined && (
        <article className="doc mt-8">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                const target = href ?? ''

                if (/^https?:\/\//.test(target)) {
                  return (
                    <a
                      href={target}
                      onClick={(event) => {
                        event.preventDefault()
                        window.prumo.openExternal(target)
                      }}
                    >
                      {children}
                    </a>
                  )
                }

                // A link between documents is navigation inside the app, not a page load.
                return (
                  <a
                    href={target}
                    onClick={(event) => {
                      event.preventDefault()
                      navigate({ to: '/docs', search: { path, doc: resolveLink(doc, target) } })
                    }}
                  >
                    {children}
                  </a>
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
