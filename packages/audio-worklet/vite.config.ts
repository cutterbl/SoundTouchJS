import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/processor.ts'),
      formats: ['es'],
      fileName: () => 'soundtouch-processor.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: false,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@soundtouchjs/core': resolve(
        import.meta.dirname,
        '../core/src/index.ts',
      ),
    },
  },
});
