import { GitBranch } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GitState } from '../../shared/ipc.ts'
import { useT } from '../i18n/i18n.tsx'

/** How often the badge reads Git again: a commit made in a terminal shows up without a reload. */
const EVERY_MS = 10_000

/** The project's branch, and its uncommitted changes when there are any. Nothing for a folder without Git. */
export function GitBadge({ path }: { path: string }) {
  const t = useT()
  const [git, setGit] = useState<GitState>()

  useEffect(() => {
    let current = true
    const read = () =>
      window.prumo.projects.git(path).then((state) => {
        if (current) setGit(state)
      })

    read()
    const again = setInterval(read, EVERY_MS)

    return () => {
      current = false
      clearInterval(again)
    }
  }, [path])

  if (git === undefined) return null

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[0.72rem] text-muted-foreground">
      <GitBranch className="size-3.5" />
      {git.branch ?? t.git.detached}
      {git.changes > 0 && <span className="text-warning">· {t.git.changes(git.changes)}</span>}
    </span>
  )
}
