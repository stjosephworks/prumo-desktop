import { GitBranch } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GitState } from '../../shared/ipc.ts'

/** How often the badge reads Git again: a commit made in a terminal shows up without a reload. */
const EVERY_MS = 10_000

/** The project's branch, and its uncommitted changes when there are any. Nothing for a folder without Git. */
export function GitBadge({ path }: { path: string }) {
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
    <span className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] text-muted-foreground">
      <GitBranch className="size-3.5" />
      {git.branch ?? 'detached'}
      {git.changes > 0 && (
        <span className="text-warning">
          · {git.changes} {git.changes === 1 ? 'change' : 'changes'}
        </span>
      )}
    </span>
  )
}
