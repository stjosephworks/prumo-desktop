import { defineConfig } from 'vite'

// node-pty is native: it stays a runtime require, resolved from node_modules inside the package.
export default defineConfig({
  build: { rollupOptions: { external: ['node-pty'] } },
})
