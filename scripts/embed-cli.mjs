// Puts a pinned @stjoseph/prumo, with its production dependencies, in resources/prumo.
// Forge copies that folder next to app.asar (extraResource), because spawn cannot run files inside the archive.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const VERSION = '0.0.5'
const root = join(import.meta.dirname, '..')
const target = join(root, 'resources', 'prumo')

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })

const tarball = execFileSync('npm', ['pack', `@stjoseph/prumo@${VERSION}`, '--silent'], {
  cwd: join(root, 'resources'),
  encoding: 'utf8',
}).trim()

execFileSync('tar', ['-xzf', tarball, '-C', target, '--strip-components=1'], {
  cwd: join(root, 'resources'),
})
rmSync(join(root, 'resources', tarball))
execFileSync(
  'npm',
  ['install', '--omit=dev', '--ignore-scripts', '--no-package-lock', '--silent'],
  {
    cwd: target,
    stdio: 'inherit',
  },
)

console.log(`Embedded @stjoseph/prumo@${VERSION}:`, readdirSync(target).join(', '))
