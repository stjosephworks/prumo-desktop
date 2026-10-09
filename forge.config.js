const { chmodSync, cpSync, existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const { VitePlugin } = require('@electron-forge/plugin-vite')
const { signingMode } = require('./build/signing.cjs')

// The Vite plugin packages only its bundles, never node_modules. node-pty is native and external to the bundle,
// so it is copied in by hand, and left outside app.asar: its spawn-helper must be a real file to be executed.
const NATIVE = ['node-pty']

// Developer ID with notarization when APPLE_ID, APPLE_PASSWORD and APPLE_TEAM_ID are set, ad-hoc when none is,
// an error when only some are: build/signing.cjs. Credentials come only from the environment, as Forge's guide asks.
const MODE = signingMode()
const developerId = MODE === 'developer-id'

// Electron's helper apps keep @electron/osx-sign's own entitlements for them; every other file, the app itself
// included, gets only what build/entitlements.mac.plist explains. What optionsForFile returns is merged over
// osx-sign's defaults for the file.
const HELPER = /\((GPU|Renderer|Plugin)\)\.app/
const ENTITLEMENTS = join(__dirname, 'build', 'entitlements.mac.plist')
const ICON = join(__dirname, 'build', 'icon.icns')

module.exports = {
  // One output folder per arch in a release: Forge makes the arches concurrently, and the dmg maker writes every
  // arch to the same temporary name before renaming it, so two arches in one run collide ("Target already exists").
  outDir: process.env.FORGE_OUT_DIR,
  packagerConfig: {
    // CFBundleIdentifier, from stjosephworks.org. Once a release is out, changing it makes macOS see another app.
    // Unset, Packager writes com.electron.prumo-desktop.
    appBundleId: 'org.stjosephworks.prumo-desktop',
    appCategoryType: 'public.app-category.developer-tools',
    appCopyright: 'Copyright © 2026 Leonardo Freitas',
    // build/icon.icns, rendered from build/icon.svg by scripts/make-icon.mjs; Packager adds the extension.
    icon: join(__dirname, 'build', 'icon'),
    asar: { unpack: '**/node_modules/node-pty/**' },
    // spawn cannot run files inside app.asar, so the embedded CLI sits next to it, in Contents/Resources/prumo.
    extraResource: ['resources/prumo'],
    // Ad-hoc signing has no Team ID, and the Hardened Runtime's library validation then refuses to load Electron
    // Framework into the app ("different Team IDs"), so the runtime is on only with a Developer ID. Notarization
    // needs it; an ad-hoc build is never notarized. --timestamp=none: Apple's timestamp service serves real
    // identities only.
    osxSign: {
      // Electron Packager otherwise only warns when codesign fails, and an unsigned app would be released.
      continueOnError: false,
      ...(developerId ? {} : { identity: '-', identityValidation: false }),
      optionsForFile: (filePath) => {
        const runtime = developerId ? {} : { hardenedRuntime: false, timestamp: 'none' }
        return HELPER.test(filePath)
          ? runtime
          : { entitlements: ENTITLEMENTS, hardenedRuntime: true, ...runtime }
      },
    },
    ...(developerId
      ? {
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
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { icon: ICON } },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      // A draft until someone publishes it on GitHub: update.electronjs.org only serves published releases, so
      // nothing reaches users before a person has looked at it. GITHUB_TOKEN authenticates.
      // An ad-hoc build is a pre-release: update.electronjs.org skips pre-releases, so it is never offered as an
      // update, and a signed release that follows is not offered to it either (its updater is off).
      config: {
        repository: { owner: 'stjosephworks', name: 'prumo-desktop' },
        draft: true,
        prerelease: !developerId,
      },
    },
  ],
  hooks: {
    packageAfterCopy: async (_config, buildPath, _electronVersion, platform, arch) => {
      for (const name of NATIVE) {
        cpSync(join(__dirname, 'node_modules', name), join(buildPath, 'node_modules', name), {
          recursive: true,
          // Without sources or binding.gyp, Forge does not try to rebuild it: its N-API prebuilds already match.
          // Only the prebuild of the platform and arch being packaged: node-pty loads
          // prebuilds/<platform>-<arch>, and Windows binaries have no business inside a signed Mac app.
          filter: (source) =>
            !/node-pty\/(src|deps|scripts|typings|third_party)(\/|$)/.test(source) &&
            !source.endsWith('binding.gyp') &&
            !new RegExp(`node-pty/prebuilds/(?!${platform}-${arch}(/|$))[^/]+`).test(source),
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
