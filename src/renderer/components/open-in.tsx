import { Code, FolderOpen, SquareTerminal } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Openers } from '../../shared/ipc.ts'
import { Button } from './ui.tsx'

const SHORT: Record<string, string> = { 'Visual Studio Code': 'VS Code' }

/** Finder, the first editor this machine has, and its terminal, each opening the project's folder. */
export function OpenIn({ path }: { path: string }) {
  const [openers, setOpeners] = useState<Openers>({ editors: [], terminals: [] })

  useEffect(() => {
    window.prumo.projects.openers().then(setOpeners)
  }, [])

  const [editor] = openers.editors
  const [terminal] = openers.terminals

  return (
    <>
      <Button variant="ghost" onClick={() => window.prumo.projects.reveal(path)}>
        <FolderOpen />
        Finder
      </Button>
      {editor !== undefined && (
        <Button variant="ghost" onClick={() => window.prumo.projects.openIn(editor, path)}>
          <Code />
          {SHORT[editor] ?? editor}
        </Button>
      )}
      {terminal !== undefined && (
        <Button variant="ghost" onClick={() => window.prumo.projects.openIn(terminal, path)}>
          <SquareTerminal />
          {SHORT[terminal] ?? terminal}
        </Button>
      )}
    </>
  )
}
