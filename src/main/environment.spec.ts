// The rules for finding a command, and npm as this machine really has it.
import { existsSync } from 'node:fs'
import { expect, test } from 'vitest'
import { executableNames, findNode, findOnPath, npmCommand } from './environment.ts'

test('Windows looks a command up through PATHEXT, and never as a bare name', () => {
  expect(executableNames('npm', 'win32', '.COM;.EXE;.BAT;.CMD')).toEqual([
    'npm.com',
    'npm.exe',
    'npm.bat',
    'npm.cmd',
  ])
  expect(executableNames('node.exe', 'win32', '.COM;.EXE')).toEqual(['node.exe'])
  // An empty PATHEXT means Windows' own default.
  expect(executableNames('git', 'win32', '')).toEqual(['git.com', 'git.exe', 'git.bat', 'git.cmd'])
})

test('macOS and Linux look a command up by its name alone', () => {
  expect(executableNames('npm', 'darwin', '.EXE')).toEqual(['npm'])
  expect(executableNames('npm', 'linux', '')).toEqual(['npm'])
})

test('finds node and npm on this machine', async () => {
  expect(findOnPath('node')).toBeTruthy()
  expect(findOnPath('npm')).toBeTruthy()
  expect(findOnPath('no-such-command-anywhere')).toBeUndefined()
})

test('npm runs through its own npm-cli.js with Node, which works for a .cmd as well', async () => {
  const node = await findNode()
  const npm = findOnPath('npm')

  if (node === undefined || npm === undefined) throw new Error('this machine has no node or npm')

  const { command, args } = npmCommand(npm, node.path)

  expect(command).toBe(node.path)
  expect(args).toHaveLength(1)
  expect(args[0]).toMatch(/npm-cli\.js$/)
  expect(existsSync(args[0] ?? '')).toBe(true)
})
