import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    coverage: {
      exclude: ['src/index.ts'],
      thresholds: {
        branches: 85,
        functions: 95,
      },
    },
  },
});
