/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../node_modules/.vite/storybook',
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4200,
    host: 'localhost',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@soundtouchjs/core': `${import.meta.dirname}/../packages/core/src/index.ts`,
      '@soundtouchjs/audio-worklet': `${import.meta.dirname}/../packages/audio-worklet/src/index.ts`,
      '@soundtouchjs/interpolation-strategy-blackman': `${import.meta.dirname}/../packages/interpolation-strategy-blackman/src/index.ts`,
      '@soundtouchjs/interpolation-strategy-hann': `${import.meta.dirname}/../packages/interpolation-strategy-hann/src/index.ts`,
      '@soundtouchjs/interpolation-strategy-kaiser': `${import.meta.dirname}/../packages/interpolation-strategy-kaiser/src/index.ts`,
      '@soundtouchjs/interpolation-strategy-lanczos': `${import.meta.dirname}/../packages/interpolation-strategy-lanczos/src/index.ts`,
      '@soundtouchjs/interpolation-strategy-linear': `${import.meta.dirname}/../packages/interpolation-strategy-linear/src/index.ts`,
    },
  },
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
