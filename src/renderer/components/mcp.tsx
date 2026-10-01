import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../i18n/i18n.tsx'
import { Section, StatusDot } from './ui.tsx'

/** A value to copy, set in mono, with its own copy button; it says Copied for a moment after a click. */
function CopyLine({ label, value }: { label: string; value: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  return (
    <div>
      <p className="mb-1.5 text-[0.8rem] font-medium text-ink">{label}</p>
      <div className="flex items-center gap-3 rounded-md border border-rule bg-card px-3 py-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[0.78rem] text-ink">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            await window.prumo.copy(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-sm border border-rule px-2 py-1 text-xs text-muted-foreground hover:border-brass hover:text-ink"
        >
          {copied ? <Check className="size-3.5 text-brass-ink" /> : <Copy className="size-3.5" />}
          {copied ? t.common.copied : t.common.copy}
        </button>
      </div>
    </div>
  )
}

/**
 * How an AI assistant reaches this project's API. The server is the API's `/api/mcp`; the address follows the port
 * the API's check settled, which is also what ports.mjs writes into BETTER_AUTH_URL. Signing in and consenting
 * happen on the web app, so both have to run.
 */
export function McpPanel({
  name,
  apiPort,
  apiRunning,
  webRunning,
}: {
  name: string
  apiPort?: number
  apiRunning: boolean
  webRunning: boolean
}) {
  const t = useT()
  const url = apiPort === undefined ? undefined : `http://localhost:${apiPort}/api/mcp`

  return (
    <Section className="mt-10" title="MCP">
      <div className="space-y-5 rounded-md border border-rule bg-card p-5">
        <p className="text-sm text-muted-foreground">{t.mcp.intro}</p>

        <ul className="flex gap-6 text-sm">
          <li className="flex items-center gap-2">
            <StatusDot state={apiRunning ? 'running' : 'stopped'} />
            {t.mcp.apiServes}
          </li>
          <li className="flex items-center gap-2">
            <StatusDot state={webRunning ? 'running' : 'stopped'} />
            {t.mcp.webServes}
          </li>
        </ul>

        {url === undefined ? (
          <p className="text-sm text-muted-foreground">{t.mcp.startApi}</p>
        ) : (
          <>
            <CopyLine label={t.mcp.server} value={url} />
            <div>
              <CopyLine
                label="Claude Code"
                value={`claude mcp add --transport http ${name} ${url}`}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t.mcp.thenBefore} <code className="font-mono text-ink">/mcp</code>{' '}
                {t.mcp.thenAfter}
              </p>
            </div>
          </>
        )}
      </div>
    </Section>
  )
}
