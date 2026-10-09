import { createRequire } from 'node:module'
import { defineConfig } from 'vite'

const { signingMode } = createRequire(import.meta.url)('./build/signing.cjs')

// node-pty is native: it stays a runtime require, resolved from node_modules inside the package.
// DEVELOPER_ID_BUILD is baked in at build time: only a Developer ID build may update itself (src/main/updates.ts).
export default defineConfig({
  build: { rollupOptions: { external: ['node-pty'] } },
  define: { DEVELOPER_ID_BUILD: JSON.stringify(signingMode() === 'developer-id') },
})
