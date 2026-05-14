import { defineConfig, type Plugin } from 'vite';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';

const __dirname = import.meta.dirname;

function processorPlugin(
  pluginName: string,
  srcPath: string,
  servePath: string,
): Plugin {
  return {
    name: pluginName,
    configureServer(server) {
      server.middlewares.use(servePath, (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        createReadStream(srcPath).pipe(res);
      });
    },
    async generateBundle() {
      const { readFile } = await import('node:fs/promises');
      this.emitFile({
        type: 'asset',
        fileName: servePath.slice(1),
        source: await readFile(srcPath, 'utf-8'),
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [
    processorPlugin(
      'soundtouch-processor',
      resolve(__dirname, '../../packages/audio-worklet/.dist/soundtouch-processor.js'),
      '/soundtouch-processor.js',
    ),
    processorPlugin(
      'phase-vocoder-processor',
      resolve(__dirname, '../../packages/phase-vocoder-worklet/.dist/phase-vocoder-processor.js'),
      '/phase-vocoder-processor.js',
    ),
    processorPlugin(
      'formant-correction-processor',
      resolve(__dirname, '../../packages/formant-correction-worklet/.dist/formant-correction-processor.js'),
      '/formant-correction-processor.js',
    ),
  ],
  server: {
    port: 8080,
    open: true,
  },
  resolve: {
    alias: {
      '@soundtouchjs/core': `${__dirname}/../../packages/core/src/index.ts`,
      '@soundtouchjs/audio-worklet': `${__dirname}/../../packages/audio-worklet/src/index.ts`,
      '@soundtouchjs/phase-vocoder-worklet': `${__dirname}/../../packages/phase-vocoder-worklet/src/index.ts`,
      '@soundtouchjs/formant-correction-worklet': `${__dirname}/../../packages/formant-correction-worklet/src/index.ts`,
      '@soundtouchjs/interpolation-strategy-lanczos': `${__dirname}/../../packages/interpolation-strategy-lanczos/src/index.ts`,
      '@soundtouchjs/interpolation-strategy-linear': `${__dirname}/../../packages/interpolation-strategy-linear/src/index.ts`,
      '@soundtouchjs/interpolation-strategy-hann': `${__dirname}/../../packages/interpolation-strategy-hann/src/index.ts`,
      '@soundtouchjs/interpolation-strategy-blackman': `${__dirname}/../../packages/interpolation-strategy-blackman/src/index.ts`,
      '@soundtouchjs/interpolation-strategy-kaiser': `${__dirname}/../../packages/interpolation-strategy-kaiser/src/index.ts`,
    },
  },
});
