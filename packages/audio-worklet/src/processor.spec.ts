it('falls back to lanczos8 and logs info for unknown interpolation strategy', async () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  await import('./processor.js');
  expect(registeredCtor).toBeDefined();
  new registeredCtor!({
    processorOptions: {
      sampleBufferType: 'circular',
      interpolationStrategy: 'not-a-real-strategy',
    },
  });
  expect(soundTouchCtorArgs).toHaveLength(1);
  expect(soundTouchCtorArgs[0]).toEqual(
    expect.objectContaining({
      sampleBufferType: 'circular',
      interpolationStrategy: 'lanczos8',
    }),
  );
  expect(infoSpy).toHaveBeenCalledWith(
    expect.stringContaining('Unknown interpolation strategy id:'),
    'not-a-real-strategy',
    expect.stringContaining('falling back to lanczos8.'),
  );
  infoSpy.mockRestore();
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RegisteredProcessorCtor = new (options?: {
  processorOptions?: {
    sampleBufferType?: 'circular' | 'fifo';
    interpolationStrategy?: 'linear' | 'lanczos8';
  };
}) => {
  process: (
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ) => boolean;
};

let registeredCtor: RegisteredProcessorCtor | undefined;
let outputFrameCount = 0;

const putSamples = vi.fn();
const extract = vi.fn();
const receive = vi.fn();
const soundTouchCtorArgs: unknown[] = [];

vi.mock('@soundtouchjs/core', () => {
  class SoundTouch {
    inputBuffer = {
      putSamples,
    };

    outputBuffer = {
      get frameCount() {
        return outputFrameCount;
      },
      extract,
      receive,
    };

    rate = 1;
    tempo = 1;
    pitch = 1;

    constructor(options?: unknown) {
      soundTouchCtorArgs.push(options);
    }

    process(): void {}
  }

  return { SoundTouch };
});

beforeEach(() => {
  vi.resetModules();
  registeredCtor = undefined;
  putSamples.mockReset();
  extract.mockReset();
  receive.mockReset();
  soundTouchCtorArgs.length = 0;
  outputFrameCount = 0;

  vi.stubGlobal('sampleRate', 48000);
  vi.stubGlobal('AudioWorkletProcessor', class AudioWorkletProcessor {});
  vi.stubGlobal(
    'registerProcessor',
    vi.fn((name: string, ctor: RegisteredProcessorCtor) => {
      if (name === 'soundtouch-processor') {
        registeredCtor = ctor;
      }
    }),
  );
});

describe('processor', () => {
  describe('constructor options', () => {
    it('forwards interpolationStrategy into SoundTouch options', async () => {
      await import('./processor.js');

      expect(registeredCtor).toBeDefined();

      new registeredCtor!({
        processorOptions: {
          sampleBufferType: 'circular',
          interpolationStrategy: 'lanczos8',
        },
      });

      expect(soundTouchCtorArgs).toHaveLength(1);
      expect(soundTouchCtorArgs[0]).toEqual(
        expect.objectContaining({
          sampleBufferType: 'circular',
          interpolationStrategy: 'lanczos8',
        }),
      );
    });
  });

  describe('output extraction', () => {
    it('reads output via extract + receive so circular buffers work', async () => {
      await import('./processor.js');

      expect(registeredCtor).toBeDefined();

      extract.mockImplementation((target: Float32Array) => {
        target[0] = 0.1;
        target[1] = 0.2;
        target[2] = 0.3;
        target[3] = 0.4;
      });
      outputFrameCount = 2;

      const instance = new registeredCtor!({
        processorOptions: { sampleBufferType: 'circular' },
      });

      const inputLeft = new Float32Array([1, 3]);
      const inputRight = new Float32Array([2, 4]);
      const outputLeft = new Float32Array(2);
      const outputRight = new Float32Array(2);

      const result = instance.process(
        [[inputLeft, inputRight]],
        [[outputLeft, outputRight]],
        {
          pitch: new Float32Array([1]),
          tempo: new Float32Array([1]),
          rate: new Float32Array([1]),
          pitchSemitones: new Float32Array([0]),
          playbackRate: new Float32Array([1]),
        },
      );

      expect(result).toBe(true);
      expect(putSamples).toHaveBeenCalledWith(expect.any(Float32Array), 0, 2);
      expect(extract).toHaveBeenCalledWith(expect.any(Float32Array), 0, 2);
      expect(receive).toHaveBeenCalledWith(2);
      expect(outputLeft[0]).toBeCloseTo(0.1, 6);
      expect(outputLeft[1]).toBeCloseTo(0.3, 6);
      expect(outputRight[0]).toBeCloseTo(0.2, 6);
      expect(outputRight[1]).toBeCloseTo(0.4, 6);
    });

    it('stays stable across repeated render quanta with lanczos8 and underflow', async () => {
      await import('./processor.js');

      expect(registeredCtor).toBeDefined();

      let quantum = 0;
      extract.mockImplementation(
        (target: Float32Array, _start: number, frames: number) => {
          for (let i = 0; i < frames; i++) {
            const base = i * 2;
            target[base] =
              i === 0 && quantum === 2 ? Number.NaN : Math.sin(i * 0.03);
            target[base + 1] =
              i === 1 && quantum === 3
                ? Number.POSITIVE_INFINITY
                : Math.cos(i * 0.03);
          }
        },
      );

      const instance = new registeredCtor!({
        processorOptions: {
          interpolationStrategy: 'lanczos8',
          sampleBufferType: 'circular',
        },
      });

      for (let q = 0; q < 5; q++) {
        quantum = q;
        outputFrameCount = q % 2 === 0 ? 96 : 128;

        const inputLeft = new Float32Array(128);
        const inputRight = new Float32Array(128);
        for (let i = 0; i < 128; i++) {
          inputLeft[i] = Math.sin((q * 128 + i) * 0.01);
          inputRight[i] = Math.cos((q * 128 + i) * 0.01);
        }

        const outputLeft = new Float32Array(128);
        const outputRight = new Float32Array(128);

        const ok = instance.process(
          [[inputLeft, inputRight]],
          [[outputLeft, outputRight]],
          {
            pitch: new Float32Array([1]),
            tempo: new Float32Array([1]),
            rate: new Float32Array([1.1]),
            pitchSemitones: new Float32Array([0]),
            playbackRate: new Float32Array([1]),
          },
        );

        expect(ok).toBe(true);

        const expectedExtracted = Math.min(outputFrameCount, 128);
        for (let i = 0; i < expectedExtracted; i++) {
          expect(Number.isFinite(outputLeft[i])).toBe(true);
          expect(Number.isFinite(outputRight[i])).toBe(true);
        }
        for (let i = expectedExtracted; i < 128; i++) {
          expect(outputLeft[i]).toBe(0);
          expect(outputRight[i]).toBe(0);
        }
      }

      expect(putSamples).toHaveBeenCalledTimes(5);
      expect(extract).toHaveBeenCalledTimes(5);
      expect(receive).toHaveBeenCalledTimes(5);
      expect(soundTouchCtorArgs).toHaveLength(1);
      expect(soundTouchCtorArgs[0]).toEqual(
        expect.objectContaining({
          interpolationStrategy: 'lanczos8',
          sampleBufferType: 'circular',
        }),
      );
    });
  });
});
