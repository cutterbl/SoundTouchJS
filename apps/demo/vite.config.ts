import { defineConfig, type Plugin } from 'vite';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';

const processorFile = resolve(
  import.meta.dirname,
  '../../packages/audio-worklet/dist/soundtouch-processor.js',
);

function soundtouchProcessorPlugin(): Plugin {
  return {
    name: 'soundtouch-processor',
    configureServer(server) {
      server.middlewares.use('/soundtouch-processor.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        createReadStream(processorFile).pipe(res);
      });
    },
    async generateBundle() {
      const { readFile } = await import('node:fs/promises');
      this.emitFile({
        type: 'asset',
        fileName: 'soundtouch-processor.js',
        source: await readFile(processorFile, 'utf-8'),
      });
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [soundtouchProcessorPlugin()],
  server: {
    port: 8080,
    open: true,
  },
  resolve: {
    alias: {
      '@soundtouchjs/core': `${import.meta.dirname}/../../packages/core/src/index.ts`,
      '@soundtouchjs/audio-worklet': `${import.meta.dirname}/../../packages/audio-worklet/src/index.ts`,
    },
  },
});
