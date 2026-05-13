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
    inputBuffer = { putSamples };
    outputBuffer = {
      get frameCount() { return outputFrameCount; },
      extract,
      receive,
    };
    rate = 1;
    tempo = 1;
    pitch = 1;
    setInterpolationStrategy(s: unknown): void { setInterpolationStrategy(s); }
    setInterpolationStrategyParams(p: unknown): void { setInterpolationStrategyParams(p); }
    setStretchParameters(p: unknown): void { setStretchParameters(p); }
    constructor(options?: unknown) { soundTouchCtorArgs.push(options); }
    process(): void {}
  }
  return {
    SoundTouch,
    resolveInterpolationStrategy: (strategy?: unknown) => {
      if (strategy === 'not-a-real-strategy') throw new Error('unknown');
      return 'lanczos';
    },
  };
});

const baseParams = {
  pitch: new Float32Array([1]),
  pitchSemitones: new Float32Array([0]),
  playbackRate: new Float32Array([1]),
  formantStrength: new Float32Array([0]),
};

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
      if (name === 'formant-correction-processor') registeredCtor = ctor;
    }),
  );
});

describe('formant-correction-processor', () => {
  it('falls back to lanczos for unknown interpolation strategy', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await import('./formant-correction-processor.js');
    new registeredCtor!({
      processorOptions: { sampleBufferType: 'circular', interpolationStrategy: 'not-a-real-strategy' },
    });
    expect(soundTouchCtorArgs[0]).toEqual(
      expect.objectContaining({ interpolationStrategy: 'lanczos' }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown interpolation strategy id:'),
      'not-a-real-strategy',
      expect.stringContaining('falling back to lanczos.'),
    );
    infoSpy.mockRestore();
  });

  it('applies pending interpolation strategy update', async () => {
    await import('./formant-correction-processor.js');
    const instance = new registeredCtor!({
      processorOptions: { sampleBufferType: 'circular' },
    }) as unknown as {
      port: { onmessage: ((e: { data: unknown }) => void) | null };
      process: RegisteredProcessorCtor['prototype']['process'];
    };

    instance.port.onmessage?.({ data: { type: 'set-interpolation-strategy', strategy: 'linear' } });
    instance.process([[new Float32Array(2)]], [[new Float32Array(2), new Float32Array(2)]], baseParams);

    expect(setInterpolationStrategy).toHaveBeenCalledWith('linear');
  });

  it('applies pending stretch parameters update', async () => {
    await import('./formant-correction-processor.js');
    const instance = new registeredCtor!({
      processorOptions: { sampleBufferType: 'circular' },
    }) as unknown as {
      port: { onmessage: ((e: { data: unknown }) => void) | null };
      process: RegisteredProcessorCtor['prototype']['process'];
    };

    instance.port.onmessage?.({ data: { type: 'set-stretch-parameters', params: { overlapMs: 8 } } });
    instance.process([[new Float32Array(2)]], [[new Float32Array(2), new Float32Array(2)]], baseParams);

    expect(setStretchParameters).toHaveBeenCalledWith({ overlapMs: 8 });
  });

  it('returns early when input/output is missing', async () => {
    await import('./formant-correction-processor.js');
    const instance = new registeredCtor!({ processorOptions: { sampleBufferType: 'circular' } });
    expect(instance.process([], [], baseParams)).toBe(true);
    expect(instance.process([[]], [[]], baseParams)).toBe(true);
    expect(instance.process([[new Float32Array(2)]], [[]], baseParams)).toBe(true);
  });

  it('bypasses LPC correction when formantStrength is 0', async () => {
    await import('./formant-correction-processor.js');
    extract.mockImplementation((target: Float32Array) => {
      target[0] = 0.1; target[1] = 0.2;
    });
    outputFrameCount = 1;

    const instance = new registeredCtor!({ processorOptions: { sampleBufferType: 'circular' } });
    const outputLeft = new Float32Array(1);
    const outputRight = new Float32Array(1);

    instance.process(
      [[new Float32Array([0.5])]],
      [[outputLeft, outputRight]],
      { ...baseParams, formantStrength: new Float32Array([0]) },
    );

    // Output should be raw extracted values (no LPC).
    expect(outputLeft[0]).toBeCloseTo(0.1, 5);
    expect(outputRight[0]).toBeCloseTo(0.2, 5);
  });

  it('applies LPC correction when formantStrength is 1 and produces finite output', async () => {
    await import('./formant-correction-processor.js');
    const frameCount = 128;
    outputFrameCount = frameCount;

    extract.mockImplementation((target: Float32Array, _start: number, frames: number) => {
      for (let i = 0; i < frames * 2; i++) target[i] = Math.sin(i * 0.1) * 0.5;
    });

    const instance = new registeredCtor!({ processorOptions: { sampleBufferType: 'circular' } });
    const leftIn = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) leftIn[i] = Math.sin(i * 0.2) * 0.4;
    const outL = new Float32Array(frameCount);
    const outR = new Float32Array(frameCount);

    instance.process(
      [[leftIn]],
      [[outL, outR]],
      { ...baseParams, formantStrength: new Float32Array([1]) },
    );

    for (let i = 0; i < frameCount; i++) {
      expect(Number.isFinite(outL[i])).toBe(true);
      expect(Number.isFinite(outR[i])).toBe(true);
    }
  });

  describe('metrics', () => {
    it('posts metrics every 100 render blocks', async () => {
      await import('./formant-correction-processor.js');
      outputFrameCount = 64;
      const instance = new registeredCtor!({
        processorOptions: { sampleBufferType: 'circular' },
      }) as unknown as {
        port: { postMessage: ReturnType<typeof vi.fn> };
        process: RegisteredProcessorCtor['prototype']['process'];
      };

      for (let i = 0; i < 100; i++) {
        instance.process(
          [[new Float32Array(128)]],
          [[new Float32Array(128), new Float32Array(128)]],
          baseParams,
        );
      }

      expect(instance.port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'metrics', blockCount: 100 }),
      );
    });

    it('increments underrunCount when output has fewer frames than requested', async () => {
      await import('./formant-correction-processor.js');
      outputFrameCount = 64;
      const instance = new registeredCtor!({
        processorOptions: { sampleBufferType: 'circular' },
      }) as unknown as {
        port: { postMessage: ReturnType<typeof vi.fn> };
        process: RegisteredProcessorCtor['prototype']['process'];
      };

      for (let i = 0; i < 100; i++) {
        instance.process(
          [[new Float32Array(128)]],
          [[new Float32Array(128), new Float32Array(128)]],
          baseParams,
        );
      }

      expect(instance.port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ underrunCount: 100 }),
      );
    });
  });

  describe('output extraction', () => {
    it('reads output via extract + receive', async () => {
      await import('./formant-correction-processor.js');
      extract.mockImplementation((target: Float32Array) => {
        target[0] = 0.1; target[1] = 0.2; target[2] = 0.3; target[3] = 0.4;
      });
      outputFrameCount = 2;

      const instance = new registeredCtor!({ processorOptions: { sampleBufferType: 'circular' } });
      const outL = new Float32Array(2);
      const outR = new Float32Array(2);

      instance.process(
        [[new Float32Array([1, 3]), new Float32Array([2, 4])]],
        [[outL, outR]],
        baseParams,
      );

      expect(extract).toHaveBeenCalledWith(expect.any(Float32Array), 0, 2);
      expect(receive).toHaveBeenCalledWith(2);
      expect(outL[0]).toBeCloseTo(0.1, 5);
      expect(outR[0]).toBeCloseTo(0.2, 5);
    });
  });
});
