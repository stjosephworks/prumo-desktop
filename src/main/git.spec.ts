// Against real repositories made for the test, with git itself.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { gitState } from './git.ts'

function repository(): string {
  const path = mkdtempSync(join(tmpdir(), 'prumo-desktop-git-'))
  const git = (...args: string[]) => execFileSync('git', ['-C', path, ...args], { stdio: 'ignore' })

  git('init', '-b', 'main')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '--allow-empty', '-m', 'first')

  return path
}

test('a clean repository has its branch and no changes', async () => {
  expect(await gitState(repository())).toEqual({ branch: 'main', changes: 0 })
})

test('new and changed files count as changes', async () => {
  const path = repository()
  writeFileSync(join(path, 'a.txt'), 'a')
  writeFileSync(join(path, 'b.txt'), 'b')

  expect(await gitState(path)).toEqual({ branch: 'main', changes: 2 })
})

test('a folder that is not a repository has no Git state', async () => {
  expect(await gitState(mkdtempSync(join(tmpdir(), 'prumo-desktop-plain-')))).toBeUndefined()
})
