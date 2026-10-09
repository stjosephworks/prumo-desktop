const { chmodSync, cpSync, existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const { VitePlugin } = require('@electron-forge/plugin-vite')

// The Vite plugin packages only its bundles, never node_modules. node-pty is native and external to the bundle,
// so it is copied in by hand, and left outside app.asar: its spawn-helper must be a real file to be executed.
const NATIVE = ['node-pty']

// Signing and notarizing need an Apple Developer ID, given only through the environment, as Forge's guide asks.
// Without it, `pnpm package` still makes an unsigned app for local use; the release workflow always has it.
const signing =
  process.env.APPLE_ID !== undefined &&
  process.env.APPLE_PASSWORD !== undefined &&
  process.env.APPLE_TEAM_ID !== undefined

module.exports = {
  packagerConfig: {
    asar: { unpack: '**/node_modules/node-pty/**' },
    // spawn cannot run files inside app.asar, so the embedded CLI sits next to it, in Contents/Resources/prumo.
    extraResource: ['resources/prumo'],
    ...(signing
      ? {
          osxSign: {},
          osxNotarize: {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
          },
        }
      : {}),
  },
  makers: [
    // The zip is what Squirrel.Mac, behind update.electronjs.org, downloads to update an installed app.
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    // The dmg is what a person downloads to install it.
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'] },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      // A draft until someone publishes it on GitHub: update.electronjs.org only serves published releases, so
      // nothing reaches users before a person has looked at it. GITHUB_TOKEN authenticates.
      config: { repository: { owner: 'stjosephworks', name: 'prumo-desktop' }, draft: true },
    },
  ],
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      for (const name of NATIVE) {
        cpSync(join(__dirname, 'node_modules', name), join(buildPath, 'node_modules', name), {
          recursive: true,
          // Without sources or binding.gyp, Forge does not try to rebuild it: its N-API prebuilds already match.
          filter: (source) =>
            !/node-pty\/(src|deps|scripts|typings|third_party)(\/|$)/.test(source) &&
            !source.endsWith('binding.gyp'),
        })
      }
      // node-pty 1.1.0 installs its prebuilt spawn-helper without the executable bit: posix_spawnp then fails.
      const prebuilds = join(buildPath, 'node_modules', 'node-pty', 'prebuilds')
      for (const platform of readdirSync(prebuilds)) {
        const helper = join(prebuilds, platform, 'spawn-helper')
        if (existsSync(helper)) chmodSync(helper, 0o755)
      }
    },
  },
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/main.ts', config: 'vite.main.config.mjs', target: 'main' },
        { entry: 'src/preload/preload.ts', config: 'vite.preload.config.mjs', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
    }),
  ],
}
