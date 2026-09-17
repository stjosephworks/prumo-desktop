import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { documentPath, OutsideKnowledgeBase, readDocument, resolveLink } from './docs.ts'

let project = ''

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'prumo-desktop-docs-'))
  mkdirSync(join(project, '.prumo', 'api'), { recursive: true })
  writeFileSync(join(project, '.prumo', 'INDEX.md'), '# Index\n\n- [Routes](api/routes.md)\n')
  writeFileSync(join(project, '.prumo', 'api', 'routes.md'), '# Routes\n')
  writeFileSync(join(project, 'secret.txt'), 'not part of the knowledge base')
})

test('reads INDEX.md by default, and any document under .prumo/', async () => {
  expect(await readDocument(project)).toContain('# Index')
  expect(await readDocument(project, 'api/routes.md')).toContain('# Routes')
})

test('refuses to read outside .prumo/, however the path is written', async () => {
  await expect(readDocument(project, '../secret.txt')).rejects.toBeInstanceOf(OutsideKnowledgeBase)
  await expect(readDocument(project, 'api/../../secret.txt')).rejects.toBeInstanceOf(
    OutsideKnowledgeBase,
  )
  expect(() => documentPath(project, '/etc/passwd')).toThrow(OutsideKnowledgeBase)
})

test('a link inside a document resolves against the document it came from', () => {
  expect(resolveLink('INDEX.md', 'api/routes.md')).toBe('api/routes.md')
  expect(resolveLink('api/routes.md', '../INDEX.md')).toBe('INDEX.md')
  expect(resolveLink('api/routes.md', 'errors.md')).toBe('api/errors.md')
})
