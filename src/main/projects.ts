// The project list: what the Desktop remembers, and what it re-reads from disk every time it is asked.
// No Electron here, so the tests run in plain Node.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import type { Project, ProjectConfig } from '../shared/ipc.ts'

/** A Prumo project is a folder holding this file; nothing else identifies one. */
const CONFIG = join('.prumo', 'config.json')

export class NotAProject extends Error {
  readonly path: string

  constructor(path: string) {
    super(`${path} has no .prumo/config.json, so it is not a Prumo project.`)
    this.path = path
  }
}

type Stored = { path: string }

/**
 * Only the paths are stored. Everything shown about a project is read from the project itself, so a project
 * changed outside the Desktop is never shown from a stale copy.
 */
export class Projects {
  private readonly file: string

  constructor(file: string) {
    this.file = file
  }

  list(): Project[] {
    return this.stored().map((entry) => this.read(entry.path))
  }

  /** Adds a folder the user picked, or the one `prumo new` just created. */
  add(path: string): Project {
    const full = resolve(path)

    if (!existsSync(join(full, CONFIG))) throw new NotAProject(full)

    const stored = this.stored()

    if (!stored.some((entry) => entry.path === full)) {
      this.write([...stored, { path: full }])
    }

    return this.read(full)
  }

  /**
   * Forgets a project. The folder is left alone, and only the user ever calls this: a project whose folder is
   * missing stays in the list, because a disconnected disk is not a decision to remove anything.
   */
  remove(path: string): void {
    const full = resolve(path)
    this.write(this.stored().filter((entry) => entry.path !== full))
  }

  private read(path: string): Project {
    const name = basename(path)

    try {
      const config = JSON.parse(readFileSync(join(path, CONFIG), 'utf8')) as ProjectConfig

      return { path, name, found: true, config }
    } catch {
      // Either the folder is gone, or it is no longer a Prumo project: both are "not found" to the user.
      return { path, name, found: false }
    }
  }

  private stored(): Stored[] {
    try {
      const content = JSON.parse(readFileSync(this.file, 'utf8')) as { projects?: Stored[] }

      return content.projects?.filter((entry) => typeof entry?.path === 'string') ?? []
    } catch {
      return []
    }
  }

  private write(projects: Stored[]): void {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, `${JSON.stringify({ projects }, null, 2)}\n`)
  }
}
