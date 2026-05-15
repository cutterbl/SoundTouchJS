import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    coverage: {
      exclude: ['src/index.ts', 'src/worklet-globals.d.ts'],
      thresholds: {
        branches: 80,
        functions: 90,
      },
    },
  },
});
