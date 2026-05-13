import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      exclude: ['src/index.ts'],
      thresholds: {
        branches: 80,
        functions: 90,
      },
    },
  },
});
