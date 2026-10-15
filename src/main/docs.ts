// Reading a project's `.prumo/` folder. Read only: the Desktop never writes there, so a future `prumo update`
// has no Desktop-made edits to merge. No Electron here, so the tests run in plain Node.
import { readFile } from 'node:fs/promises'
import { isAbsolute, posix, relative, resolve, sep } from 'node:path'

export class OutsideKnowledgeBase extends Error {
  constructor(path: string) {
    super(`${path} is outside the project's .prumo/ folder.`)
  }
}

/** The `.prumo/` folder of a project, resolved once so every read can be checked against it. */
function knowledgeBase(project: string): string {
  return resolve(project, '.prumo')
}

/**
 * Whether `full` is `base` or inside it. Compared through `relative`, never with a `/` of its own: Windows separates
 * with a backslash, and a path on another drive comes back absolute.
 */
function within(base: string, full: string): boolean {
  const path = relative(base, full)

  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

/**
 * Reads one document of the knowledge base. `document` is relative to `.prumo/`, and a path that climbs out of it
 * is refused: what the renderer asks for comes from links inside markdown the Desktop did not write.
 */
export async function readDocument(project: string, document = 'INDEX.md'): Promise<string> {
  const base = knowledgeBase(project)
  const full = resolve(base, document)

  if (!within(base, full)) throw new OutsideKnowledgeBase(document)

  return readFile(full, 'utf8')
}

/** Where a document sits on disk, for "Open in editor". */
export function documentPath(project: string, document: string): string {
  const base = knowledgeBase(project)
  const full = resolve(base, document)

  if (!within(base, full)) throw new OutsideKnowledgeBase(document)

  return full
}

/**
 * A link inside a document, turned into a path relative to `.prumo/` so the app can open it in place. Links are
 * written with `/` on every system, so they are resolved as POSIX paths.
 */
export function resolveLink(from: string, href: string): string {
  return posix.relative('.', posix.join(from, '..', href))
}
