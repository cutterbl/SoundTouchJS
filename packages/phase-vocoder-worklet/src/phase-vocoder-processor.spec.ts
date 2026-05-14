import { beforeEach, describe, expect, it, vi } from 'vitest';

type RegisteredProcessorCtor = new (options?: {
  processorOptions?: {
    sampleBufferType?: 'circular' | 'fifo';
    interpolationStrategy?: 'linear' | 'lanczos';
    fftSize?: 512 | 1024 | 2048 | 4096;
    overlapFactor?: 2 | 4 | 8;
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

vi.mock('@soundtouchjs/stretch-phase-vocoder', () => {
  const mockFactory = vi.fn(() => ({}));
  return {
    createPhaseVocoderFactory: vi.fn((_fftSize?: unknown, _overlapFactor?: unknown) => mockFactory),
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
        postMessage: vi.fn(),
      };
    },
  );
  vi.stubGlobal(
    'registerProcessor',
    vi.fn((name: string, ctor: RegisteredProcessorCtor) => {
      if (name === 'phase-vocoder-processor') {
        registeredCtor = ctor;
      }
    }),
  );
});

describe('phase-vocoder-processor', () => {
  it('falls back to lanczos and logs info for unknown interpolation strategy', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await import('./phase-vocoder-processor.js');
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
    await import('./phase-vocoder-processor.js');
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

    await import('./phase-vocoder-processor.js');
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

    const inputLeft = new Float32Array([1, 2]);
    const outputLeft = new Float32Array(2);
    const outputRight = new Float32Array(2);

    instance.process([[inputLeft]], [[outputLeft, outputRight]], {
      pitch: new Float32Array([1]),
      pitchSemitones: new Float32Array([0]),
      playbackRate: new Float32Array([1]),
    });

    expect(infoSpy).toHaveBeenCalledWith(
      '[PhaseVocoderProcessor] Failed to switch interpolation strategy:',
      'linear',
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[PhaseVocoderProcessor] Failed to update interpolation strategy params.',
    );
    infoSpy.mockRestore();
  });

  it('returns early when process input/output is missing', async () => {
    await import('./phase-vocoder-processor.js');
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
    await import('./phase-vocoder-processor.js');
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

  describe('constructor options', () => {
    it('forwards fftSize and overlapFactor into SoundTouch stretchFactory', async () => {
      const { createPhaseVocoderFactory } = await import(
        '@soundtouchjs/stretch-phase-vocoder'
      );
      await import('./phase-vocoder-processor.js');

      new registeredCtor!({
        processorOptions: {
          sampleBufferType: 'circular',
          fftSize: 1024,
          overlapFactor: 8,
        },
      });

      expect(createPhaseVocoderFactory).toHaveBeenCalledWith(1024, 8);
    });

    it('uses default fftSize=2048 and overlapFactor=4 when not specified', async () => {
      const { createPhaseVocoderFactory } = await import(
        '@soundtouchjs/stretch-phase-vocoder'
      );
      await import('./phase-vocoder-processor.js');

      new registeredCtor!({ processorOptions: { sampleBufferType: 'circular' } });

      expect(createPhaseVocoderFactory).toHaveBeenCalledWith(2048, 4);
    });

    it('includes stretchFactory in SoundTouch constructor options', async () => {
      await import('./phase-vocoder-processor.js');

      new registeredCtor!({ processorOptions: { sampleBufferType: 'circular' } });

      expect(soundTouchCtorArgs).toHaveLength(1);
      expect(
        (soundTouchCtorArgs[0] as Record<string, unknown>).stretchFactory,
      ).toBeDefined();
    });
  });

  describe('metrics', () => {
    it('posts metrics to port every 100 render blocks', async () => {
      await import('./phase-vocoder-processor.js');
      outputFrameCount = 64;

      const instance = new registeredCtor!({
        processorOptions: { sampleBufferType: 'circular' },
      }) as unknown as {
        port: {
          onmessage: ((event: { data: unknown }) => void) | null;
          postMessage: ReturnType<typeof vi.fn>;
        };
        process: RegisteredProcessorCtor['prototype']['process'];
      };

      const params = {
        pitch: new Float32Array([1]),
        pitchSemitones: new Float32Array([0]),
        playbackRate: new Float32Array([1]),
      };

      for (let i = 0; i < 100; i++) {
        instance.process(
          [[new Float32Array(128)]],
          [[new Float32Array(128), new Float32Array(128)]],
          params,
        );
      }

      expect(instance.port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'metrics',
          blockCount: 100,
          framesBuffered: 64,
        }),
      );
    });

    it('increments underrunCount when output buffer has fewer frames than requested', async () => {
      await import('./phase-vocoder-processor.js');

      const instance = new registeredCtor!({
        processorOptions: { sampleBufferType: 'circular' },
      }) as unknown as {
        port: {
          onmessage: ((event: { data: unknown }) => void) | null;
          postMessage: ReturnType<typeof vi.fn>;
        };
        process: RegisteredProcessorCtor['prototype']['process'];
      };

      const params = {
        pitch: new Float32Array([1]),
        pitchSemitones: new Float32Array([0]),
        playbackRate: new Float32Array([1]),
      };

      outputFrameCount = 64;
      for (let i = 0; i < 100; i++) {
        instance.process(
          [[new Float32Array(128)]],
          [[new Float32Array(128), new Float32Array(128)]],
          params,
        );
      }

      expect(instance.port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'metrics',
          underrunCount: 100,
        }),
      );
    });
  });

  describe('output extraction', () => {
    it('reads output via extract + receive so circular buffers work', async () => {
      await import('./phase-vocoder-processor.js');

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
  });
});
