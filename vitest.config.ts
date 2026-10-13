import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      vue: fileURLToPath(
        new URL('./apps/web/node_modules/vue/dist/vue.runtime.esm-bundler.js', import.meta.url),
      ),
      '@shift/ui': fileURLToPath(new URL('./packages/ui/src/index.ts', import.meta.url)),
      '@fsd': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
      // Thresholds only for critical modules, not for the whole repository.
      include: [
        'apps/*/src/shared/api/index.ts',
        'apps/web/src/features/create-booking/**/*.ts',
        'apps/*/src/shared/format/index.ts',
      ],
      thresholds: { lines: 80, functions: 80 },
    },
  },
})
