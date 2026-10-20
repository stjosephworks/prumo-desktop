// Puts a pinned @stjoseph/prumo, with its production dependencies, in resources/prumo.
// Forge copies that folder next to app.asar (extraResource), because spawn cannot run files inside the archive.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const VERSION = '0.6.0'
// A CLI not yet published, packed with `pnpm pack` in Prumo's cli/, to try the Desktop against before a release.
const local = process.env.PRUMO_CLI_TARBALL
const root = join(import.meta.dirname, '..')
const target = join(root, 'resources', 'prumo')

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })

// The npm that ships with the Node running this script, through its own entry point: on Windows `npm` is a .cmd,
// which Node will not start without a shell (EINVAL since the fix for CVE-2024-27980). Node's own layout puts it in
// node_modules beside node.exe on Windows, and in ../lib/node_modules beside bin/node elsewhere.
const npmCli =
  process.platform === 'win32'
    ? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    : join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')
if (!existsSync(npmCli)) throw new Error(`npm was not found beside this Node, at ${npmCli}.`)
const npm = { command: process.execPath, args: [npmCli] }

const tarball =
  local === undefined
    ? execFileSync(npm.command, [...npm.args, 'pack', `@stjoseph/prumo@${VERSION}`, '--silent'], {
        cwd: join(root, 'resources'),
        encoding: 'utf8',
      }).trim()
    : resolve(local)

execFileSync('tar', ['-xzf', tarball, '-C', target, '--strip-components=1'], {
  cwd: join(root, 'resources'),
})
if (local === undefined) rmSync(join(root, 'resources', tarball))

// Installing inside the package still resolves the peers of its devDependencies, though --omit=dev never installs
// them, and npm 11 exits 1 without a message when one cannot be placed (0.5.1's @yarnpkg/extensions wants
// @yarnpkg/core). The embedded copy never needs them, so they go before the install.
const manifestPath = join(target, 'package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
delete manifest.devDependencies
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

execFileSync(
  npm.command,
  [...npm.args, 'install', '--omit=dev', '--ignore-scripts', '--no-package-lock', '--silent'],
  {
    cwd: target,
    stdio: 'inherit',
  },
)

console.log(
  `Embedded ${local === undefined ? `@stjoseph/prumo@${VERSION}` : basename(local)}:`,
  readdirSync(target).join(', '),
)
