import { defineConfig } from 'vitest/config'

// The process and CLI layers start real processes: slower than the default timeout allows.
export default defineConfig({
  test: { include: ['src/**/*.spec.ts'], testTimeout: 60_000, hookTimeout: 60_000, pool: 'forks' },
})
