import { ArrowUpRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AppUpdate } from '../../shared/ipc.ts'
import { useT } from '../i18n/i18n.tsx'

/**
 * A newer Prumo Desktop exists: said once, at the foot of the sidebar, with the release page a click away. Nothing
 * is downloaded; the main process decides which builds check at all (src/main/updates.ts).
 */
export function UpdateNotice() {
  const t = useT()
  const [update, setUpdate] = useState<AppUpdate>()

  useEffect(() => {
    window.prumo.app.update().then(setUpdate)
    return window.prumo.app.onUpdate(setUpdate)
  }, [])

  if (update === undefined) return null

  return (
    <div className="border-t border-rule px-5 py-3 text-xs">
      <p className="text-ink">{t.appUpdate.available(update.version)}</p>
      <button
        type="button"
        onClick={() => window.prumo.openExternal(update.url)}
        className="mt-1 inline-flex items-center gap-1 font-medium text-navy hover:underline"
      >
        {t.appUpdate.open}
        <ArrowUpRight className="size-3" />
      </button>
    </div>
  )
}
