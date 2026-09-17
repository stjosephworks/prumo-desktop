const { chmodSync, cpSync, existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const { VitePlugin } = require('@electron-forge/plugin-vite')

// The Vite plugin packages only its bundles, never node_modules. node-pty is native and external to the bundle,
// so it is copied in by hand, and left outside app.asar: its spawn-helper must be a real file to be executed.
const NATIVE = ['node-pty']

module.exports = {
  packagerConfig: {
    asar: { unpack: '**/node_modules/node-pty/**' },
    // spawn cannot run files inside app.asar, so the embedded CLI sits next to it, in Contents/Resources/prumo.
    extraResource: ['resources/prumo'],
  },
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      for (const name of NATIVE) {
        cpSync(join(__dirname, 'node_modules', name), join(buildPath, 'node_modules', name), {
          recursive: true,
          // Without sources or binding.gyp, Forge does not try to rebuild it: its N-API prebuilds already match.
          filter: (source) =>
            !/node-pty\/(src|deps|scripts|typings|third_party)(\/|$)/.test(source) && !source.endsWith('binding.gyp'),
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
        { entry: 'src/main.ts', config: 'vite.main.config.mjs', target: 'main' },
        { entry: 'src/preload.ts', config: 'vite.preload.config.mjs', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
    }),
  ],
}
