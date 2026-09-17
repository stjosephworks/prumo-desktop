// node-pty 1.1.0 ships its prebuilt spawn-helper without the executable bit, and every install resets it.
// Without this, opening a pseudo terminal fails with `posix_spawnp failed`. The packaged app is fixed in
// forge.config.js, which does the same to its own copy.
import { chmodSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const prebuilds = join(import.meta.dirname, '..', 'node_modules', 'node-pty', 'prebuilds')

if (existsSync(prebuilds)) {
  for (const platform of readdirSync(prebuilds)) {
    const helper = join(prebuilds, platform, 'spawn-helper')
    if (existsSync(helper)) chmodSync(helper, 0o755)
  }
}
