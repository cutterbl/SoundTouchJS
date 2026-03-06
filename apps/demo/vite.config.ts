import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  server: {
    port: 8080,
    open: true,
  },
  resolve: {
    alias: {
      '@soundtouchjs/core': `${import.meta.dirname}/../../packages/core/src/index.ts`,
    },
  },
});
