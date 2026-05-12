import { beforeEach, describe, expect, it, vi } from 'vitest';

type RegisteredProcessorCtor = new (options?: {
  processorOptions?: {
    sampleBufferType?: 'circular' | 'fifo';
    interpolationStrategy?: 'linear' | 'lanczos';
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
const setInterpolationStrategy = vi.fn();
const setInterpolationStrategyParams = vi.fn();
const setStretchParameters = vi.fn();
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

    setInterpolationStrategy(strategy: unknown): void {
      setInterpolationStrategy(strategy);
    }

    setInterpolationStrategyParams(params: unknown): void {
      setInterpolationStrategyParams(params);
    }

    setStretchParameters(params: unknown): void {
      setStretchParameters(params);
    }

    constructor(options?: unknown) {
      soundTouchCtorArgs.push(options);
    }

    process(): void {}
  }

  return {
    SoundTouch,
    resolveInterpolationStrategy: (strategy?: unknown) => {
      if (strategy === 'not-a-real-strategy') {
        throw new Error('unknown interpolation strategy');
      }
      return 'lanczos';
    },
  };
});

beforeEach(() => {
  vi.resetModules();
  registeredCtor = undefined;
  putSamples.mockReset();
  extract.mockReset();
  receive.mockReset();
  setInterpolationStrategy.mockReset();
  setInterpolationStrategyParams.mockReset();
  setStretchParameters.mockReset();
  soundTouchCtorArgs.length = 0;
  outputFrameCount = 0;

  vi.stubGlobal('sampleRate', 48000);
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class AudioWorkletProcessor {
      port = {
        onmessage: null as ((event: { data: unknown }) => void) | null,
      };
    },
  );
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
  it('falls back to lanczos and logs info for unknown interpolation strategy', async () => {
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
        interpolationStrategy: 'lanczos',
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown interpolation strategy id:'),
      'not-a-real-strategy',
      expect.stringContaining('falling back to lanczos.'),
    );
    infoSpy.mockRestore();
  });

  it('applies pending runtime strategy updates from message port', async () => {
    await import('./processor.js');
    const instance = new registeredCtor!({
      processorOptions: { sampleBufferType: 'circular' },
    }) as unknown as {
      port: { onmessage: ((event: { data: unknown }) => void) | null };
      process: RegisteredProcessorCtor['prototype']['process'];
    };

    instance.port.onmessage?.({
      data: {
        type: 'set-interpolation-strategy',
        strategy: 'linear',
      },
    });
    instance.port.onmessage?.({
      data: {
        type: 'set-interpolation-strategy-params',
        params: { edgeHoldFrames: 3 },
      },
    });

    const inputLeft = new Float32Array([1, 2]);
    const outputLeft = new Float32Array(2);
    const outputRight = new Float32Array(2);
    outputFrameCount = 0;

    const ok = instance.process([[inputLeft]], [[outputLeft, outputRight]], {
      pitch: new Float32Array([1]),
      pitchSemitones: new Float32Array([0]),
      playbackRate: new Float32Array([1]),
    });

    expect(ok).toBe(true);
    expect(setInterpolationStrategy).toHaveBeenCalledWith('linear');
    expect(setInterpolationStrategyParams).toHaveBeenCalledWith({
      edgeHoldFrames: 3,
    });
  });

  it('logs and recovers when runtime strategy update handlers throw', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    setInterpolationStrategy.mockImplementationOnce(() => {
      throw new Error('switch failed');
    });
    setInterpolationStrategyParams.mockImplementationOnce(() => {
      throw new Error('params failed');
    });

    await import('./processor.js');
    const instance = new registeredCtor!({
      processorOptions: { sampleBufferType: 'circular' },
    }) as unknown as {
      port: { onmessage: ((event: { data: unknown }) => void) | null };
      process: RegisteredProcessorCtor['prototype']['process'];
    };

    instance.port.onmessage?.({
      data: {
        type: 'set-interpolation-strategy',
        strategy: 'linear',
      },
    });
    instance.port.onmessage?.({
      data: {
        type: 'set-interpolation-strategy-params',
        params: { edgeHoldFrames: 2 },
      },
    });
    instance.port.onmessage?.({
      data: {
        type: 'ignored-message',
      },
    } as unknown as { data: unknown });

    const inputLeft = new Float32Array([1, 2]);
    const outputLeft = new Float32Array(2);
    const outputRight = new Float32Array(2);

    instance.process([[inputLeft]], [[outputLeft, outputRight]], {
      pitch: new Float32Array([1]),
      pitchSemitones: new Float32Array([0]),
      playbackRate: new Float32Array([1]),
    });

    expect(infoSpy).toHaveBeenCalledWith(
      '[SoundTouchProcessor] Failed to switch interpolation strategy:',
      'linear',
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[SoundTouchProcessor] Failed to update interpolation strategy params.',
    );
    infoSpy.mockRestore();
  });

  it('returns early when process input/output is missing', async () => {
    await import('./processor.js');
    const instance = new registeredCtor!({
      processorOptions: { sampleBufferType: 'circular' },
    });

    const params = {
      pitch: new Float32Array([1]),
      pitchSemitones: new Float32Array([0]),
      playbackRate: new Float32Array([1]),
    };

    expect(instance.process([], [], params)).toBe(true);
    expect(instance.process([[]], [[]], params)).toBe(true);
    expect(instance.process([[new Float32Array(2)]], [[]], params)).toBe(true);
  });

  it('applies pending stretch parameter updates from message port', async () => {
    await import('./processor.js');
    const instance = new registeredCtor!({
      processorOptions: { sampleBufferType: 'circular' },
    }) as unknown as {
      port: { onmessage: ((event: { data: unknown }) => void) | null };
      process: RegisteredProcessorCtor['prototype']['process'];
    };

    instance.port.onmessage?.({
      data: {
        type: 'set-stretch-parameters',
        params: { overlapMs: 12, quickSeek: false },
      },
    });

    const inputLeft = new Float32Array([1, 2]);
    const outputLeft = new Float32Array(2);
    const outputRight = new Float32Array(2);
    outputFrameCount = 0;

    const ok = instance.process([[inputLeft]], [[outputLeft, outputRight]], {
      pitch: new Float32Array([1]),
      pitchSemitones: new Float32Array([0]),
      playbackRate: new Float32Array([1]),
    });

    expect(ok).toBe(true);
    expect(setStretchParameters).toHaveBeenCalledWith({
      overlapMs: 12,
      quickSeek: false,
    });
  });

  it('handles mono input/output channel fallback and buffer resize path', async () => {
    await import('./processor.js');

    extract.mockImplementation(
      (target: Float32Array, _start: number, frames: number) => {
        for (let i = 0; i < frames; i++) {
          target[i * 2] = i;
          target[i * 2 + 1] = i + 0.5;
        }
      },
    );
    outputFrameCount = 256;

    const instance = new registeredCtor!({
      processorOptions: { sampleBufferType: 'circular' },
    });

    const monoInput = new Float32Array(256);
    for (let i = 0; i < monoInput.length; i++) {
      monoInput[i] = i / 10;
    }
    const monoOutput = new Float32Array(256);

    const ok = instance.process([[monoInput]], [[monoOutput]], {
      pitch: new Float32Array([1]),
      pitchSemitones: new Float32Array([0]),
      playbackRate: new Float32Array([1]),
    });

    expect(ok).toBe(true);
    expect(putSamples).toHaveBeenCalledWith(expect.any(Float32Array), 0, 256);
    expect(extract).toHaveBeenCalledWith(expect.any(Float32Array), 0, 256);
    expect(receive).toHaveBeenCalledWith(256);
    expect(monoOutput[0]).toBeCloseTo(0.5, 6);
  });

  it('handles mono output channel (single output array)', async () => {
    await import('./processor.js');

    extract.mockImplementation(
      (target: Float32Array, _start: number, frames: number) => {
        for (let i = 0; i < frames; i++) {
          target[i * 2] = 0.1;
          target[i * 2 + 1] = 0.9;
        }
      },
    );
    outputFrameCount = 2;

    const instance = new registeredCtor!({
      processorOptions: { sampleBufferType: 'circular' },
    });

    const inputLeft = new Float32Array([1, 2]);
    const monoOutput = new Float32Array(2);

    const ok = instance.process([[inputLeft]], [[monoOutput]], {
      pitch: new Float32Array([1]),
      pitchSemitones: new Float32Array([0]),
      playbackRate: new Float32Array([1]),
    });

    expect(ok).toBe(true);
    // With a single output channel, the right channel (0.9) overwrites the left (0.1) in the shared array.
    expect(monoOutput[0]).toBeCloseTo(0.9, 6);
    expect(monoOutput[1]).toBeCloseTo(0.9, 6);
  });

  describe('constructor options', () => {
    it('forwards interpolationStrategy into SoundTouch options', async () => {
      await import('./processor.js');

      expect(registeredCtor).toBeDefined();

      new registeredCtor!({
        processorOptions: {
          sampleBufferType: 'circular',
          interpolationStrategy: 'lanczos',
        },
      });

      expect(soundTouchCtorArgs).toHaveLength(1);
      expect(soundTouchCtorArgs[0]).toEqual(
        expect.objectContaining({
          sampleBufferType: 'circular',
          interpolationStrategy: 'lanczos',
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

    it('stays stable across repeated render quanta with lanczos and underflow', async () => {
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
          interpolationStrategy: 'lanczos',
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
          interpolationStrategy: 'lanczos',
          sampleBufferType: 'circular',
        }),
      );
    });
  });
});
