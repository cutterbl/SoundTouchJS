import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SoundTouchProcessorBase } from './SoundTouchProcessorBase.js';
import type { ProcessCoreResult } from './types.js';

type ProcessorBaseCtor = typeof SoundTouchProcessorBase;

const putSamples = vi.fn();
const extract = vi.fn();
const receive = vi.fn();
const setInterpolationStrategy = vi.fn();
const setInterpolationStrategyParams = vi.fn();
const setStretchParameters = vi.fn();
const postMessage = vi.fn();

let outputFrameCount = 0;

vi.mock('@soundtouchjs/core', () => {
  class SoundTouch {
    inputBuffer = { putSamples };
    outputBuffer = {
      get frameCount() {
        return outputFrameCount;
      },
      extract,
      receive,
    };

    pitch = 1;

    process(): void {}

    setInterpolationStrategy(strategy: unknown): void {
      setInterpolationStrategy(strategy);
    }

    setInterpolationStrategyParams(params: unknown): void {
      setInterpolationStrategyParams(params);
    }

    setStretchParameters(params: unknown): void {
      setStretchParameters(params);
    }

    constructor() {}
  }

  return {
    SoundTouch,
    resolveInterpolationStrategy: (strategy?: unknown) => {
      if (strategy === 'unknown-strategy') throw new Error('Unknown strategy');
      return strategy;
    },
  };
});

let ProcessorBase: ProcessorBaseCtor;

beforeEach(async () => {
  vi.resetModules();
  putSamples.mockReset();
  extract.mockReset();
  receive.mockReset();
  setInterpolationStrategy.mockReset();
  setInterpolationStrategyParams.mockReset();
  setStretchParameters.mockReset();
  postMessage.mockReset();
  outputFrameCount = 0;

  vi.stubGlobal('sampleRate', 44100);
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class AudioWorkletProcessor {
      port = {
        onmessage: null as ((event: { data: unknown }) => void) | null,
        postMessage,
      };
    },
  );

  const mod = await import('./SoundTouchProcessorBase.js');
  ProcessorBase = mod.SoundTouchProcessorBase as unknown as ProcessorBaseCtor;
});

function makeConcreteClass() {
  const onProcessComplete = vi.fn();

  class TestProcessor extends (ProcessorBase as unknown as typeof SoundTouchProcessorBase) {
    protected onProcessComplete(result: ProcessCoreResult): void {
      onProcessComplete(result);
    }
  }

  return { TestProcessor, onProcessComplete };
}

function makeInputs(frameCount = 128, channels = 2): Float32Array[][] {
  return [Array.from({ length: channels }, () => new Float32Array(frameCount))];
}

function makeOutputs(frameCount = 128, channels = 2): Float32Array[][] {
  return [Array.from({ length: channels }, () => new Float32Array(frameCount))];
}

function makeParams(
  overrides: Partial<Record<string, number>> = {},
): Record<string, Float32Array> {
  return {
    pitch: new Float32Array([overrides['pitch'] ?? 1.0]),
    pitchSemitones: new Float32Array([overrides['pitchSemitones'] ?? 0]),
    playbackRate: new Float32Array([overrides['playbackRate'] ?? 1.0]),
  };
}

describe('SoundTouchProcessorBase', () => {
  describe('resolveStrategy', () => {
    it('returns undefined when no strategy is provided', async () => {
      const result = ProcessorBase.resolveStrategy(undefined, '[Test]');
      expect(result).toBeUndefined();
    });

    it('returns the strategy unchanged when it is valid', async () => {
      const result = ProcessorBase.resolveStrategy('lanczos', '[Test]');
      expect(result).toBe('lanczos');
    });

    it('falls back to lanczos and logs for an unknown strategy', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const result = ProcessorBase.resolveStrategy(
        'unknown-strategy' as never,
        '[Test]',
      );
      expect(result).toBe('lanczos');
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown interpolation strategy id:'),
        'unknown-strategy',
        expect.stringContaining('falling back to lanczos.'),
      );
      infoSpy.mockRestore();
    });
  });

  describe('constructor', () => {
    it('creates the SoundTouch pipe with the provided options', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', {
        sampleRate: 44100,
        interpolationStrategy: 'lanczos',
      });
      expect(proc['_pipe']).toBeDefined();
      expect(proc['_samples']).toBeInstanceOf(Float32Array);
      expect(proc['_outputSamples']).toBeInstanceOf(Float32Array);
    });

    it('initialises counters to zero', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      expect(proc['_underrunCount']).toBe(0);
      expect(proc['_blockCount']).toBe(0);
    });

    it('sets up port.onmessage', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      expect(proc.port.onmessage).toBeTypeOf('function');
    });
  });

  describe('port message handling', () => {
    it('queues interpolation strategy change', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      proc.port.onmessage!({
        data: { type: 'set-interpolation-strategy', strategy: 'lanczos' },
      } as never);
      expect(proc['_pendingInterpolationStrategy']).toBe('lanczos');
    });

    it('queues interpolation strategy params update', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      proc.port.onmessage!({
        data: { type: 'set-interpolation-strategy-params', params: { a: 1 } },
      } as never);
      expect(proc['_pendingInterpolationStrategyParams']).toEqual({ a: 1 });
    });

    it('queues stretch parameters update', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      proc.port.onmessage!({
        data: {
          type: 'set-stretch-parameters',
          params: { sequenceMs: 100 },
        },
      } as never);
      expect(proc['_pendingStretchParameters']).toEqual({ sequenceMs: 100 });
    });
  });

  describe('applyPendingRuntimeUpdates', () => {
    it('applies a pending interpolation strategy and clears it', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      proc['_pendingInterpolationStrategy'] = 'lanczos';
      proc['applyPendingRuntimeUpdates']();
      expect(setInterpolationStrategy).toHaveBeenCalledWith('lanczos');
      expect(proc['_pendingInterpolationStrategy']).toBeNull();
    });

    it('logs and clears pending strategy on error', () => {
      setInterpolationStrategy.mockImplementationOnce(() => {
        throw new Error('fail');
      });
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      proc['_pendingInterpolationStrategy'] = 'lanczos';
      proc['applyPendingRuntimeUpdates']();
      expect(infoSpy).toHaveBeenCalled();
      expect(proc['_pendingInterpolationStrategy']).toBeNull();
      infoSpy.mockRestore();
    });

    it('applies pending interpolation strategy params and clears them', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      proc['_pendingInterpolationStrategyParams'] = { a: 1 } as never;
      proc['applyPendingRuntimeUpdates']();
      expect(setInterpolationStrategyParams).toHaveBeenCalledWith({ a: 1 });
      expect(proc['_pendingInterpolationStrategyParams']).toBeNull();
    });

    it('logs and clears pending strategy params on error', () => {
      setInterpolationStrategyParams.mockImplementationOnce(() => {
        throw new Error('fail');
      });
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      proc['_pendingInterpolationStrategyParams'] = {} as never;
      proc['applyPendingRuntimeUpdates']();
      expect(infoSpy).toHaveBeenCalled();
      expect(proc['_pendingInterpolationStrategyParams']).toBeNull();
      infoSpy.mockRestore();
    });

    it('applies pending stretch parameters and clears them', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      proc['_pendingStretchParameters'] = { sequenceMs: 50 } as never;
      proc['applyPendingRuntimeUpdates']();
      expect(setStretchParameters).toHaveBeenCalledWith({ sequenceMs: 50 });
      expect(proc['_pendingStretchParameters']).toBeNull();
    });

    it('logs and clears pending stretch parameters on error', () => {
      setStretchParameters.mockImplementationOnce(() => {
        throw new Error('fail');
      });
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      proc['_pendingStretchParameters'] = {} as never;
      proc['applyPendingRuntimeUpdates']();
      expect(infoSpy).toHaveBeenCalled();
      expect(proc['_pendingStretchParameters']).toBeNull();
      infoSpy.mockRestore();
    });
  });

  describe('processCore', () => {
    it('returns null when inputs[0] is empty', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      const result = proc['processCore']([], makeOutputs(), makeParams());
      expect(result).toBeNull();
    });

    it('returns null when outputs[0][0] is absent', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      const result = proc['processCore'](makeInputs(), [[]], makeParams());
      expect(result).toBeNull();
    });

    it('increments _blockCount on each call', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      outputFrameCount = 128;
      proc['processCore'](makeInputs(), makeOutputs(), makeParams());
      expect(proc['_blockCount']).toBe(1);
    });

    it('increments _underrunCount when output buffer has fewer frames than requested', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      outputFrameCount = 64; // less than frameCount of 128
      proc['processCore'](makeInputs(), makeOutputs(), makeParams());
      expect(proc['_underrunCount']).toBe(1);
    });

    it('does not increment _underrunCount when buffer is sufficient', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      outputFrameCount = 128;
      proc['processCore'](makeInputs(), makeOutputs(), makeParams());
      expect(proc['_underrunCount']).toBe(0);
    });

    it('returns a result with correct shape', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      outputFrameCount = 128;
      const result = proc['processCore'](makeInputs(), makeOutputs(), makeParams());
      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        frameCount: 128,
        toExtract: 128,
        available: 128,
      });
      expect(result!.leftInput).toBeInstanceOf(Float32Array);
      expect(result!.leftOutput).toBeInstanceOf(Float32Array);
    });

    it('resizes _samples and _outputSamples when frameCount exceeds current size', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      // Default size is 128*2=256; use frameCount of 256 (>128) to trigger resize
      const inputs = makeInputs(256);
      const outputs = makeOutputs(256);
      const params = makeParams();
      outputFrameCount = 256;
      proc['processCore'](inputs, outputs, params);
      expect(proc['_samples'].length).toBe(512); // 256 * 2
    });

    it('handles mono input by duplicating left channel to right', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      const monoInputs: Float32Array[][] = [[new Float32Array(128).fill(0.5)]];
      outputFrameCount = 128;
      const result = proc['processCore'](monoInputs, makeOutputs(), makeParams());
      expect(result).not.toBeNull();
      expect(putSamples).toHaveBeenCalled();
    });

    it('handles mono output by writing both channels to same array', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      const monoOutputs: Float32Array[][] = [[new Float32Array(128)]];
      outputFrameCount = 128;
      extract.mockImplementation(
        (buf: Float32Array, _: number, count: number) => {
          for (let i = 0; i < count; i++) {
            buf[i * 2] = 0.1;
            buf[i * 2 + 1] = 0.1;
          }
        },
      );
      const result = proc['processCore'](makeInputs(), monoOutputs, makeParams());
      expect(result).not.toBeNull();
    });

    it('calls beforePipeProcess hook before the pipe runs', () => {
      const beforePipeSpy = vi.fn();
      const { TestProcessor } = makeConcreteClass();
      class HookProcessor extends TestProcessor {
        protected override beforePipeProcess(
          l: Float32Array,
          r: Float32Array,
          n: number,
          p: Record<string, Float32Array>,
        ): void {
          beforePipeSpy(l, r, n, p);
        }
      }
      outputFrameCount = 128;
      const proc = new HookProcessor('[Test]', { sampleRate: 44100 });
      proc['processCore'](makeInputs(), makeOutputs(), makeParams());
      expect(beforePipeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('extractSamples', () => {
    it('returns zero RMS and peak when toExtract is 0', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      const result = proc['extractSamples'](
        new Float32Array(128),
        new Float32Array(128),
        128,
        0,
        makeParams(),
      );
      expect(result.outputRms).toBe(0);
      expect(result.outputPeak).toBe(0);
      expect(extract).not.toHaveBeenCalled();
    });

    it('calls extract and receive when toExtract > 0', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      const left = new Float32Array(128);
      const right = new Float32Array(128);
      proc['extractSamples'](left, right, 128, 64, makeParams());
      expect(extract).toHaveBeenCalledWith(
        proc['_outputSamples'],
        0,
        64,
      );
      expect(receive).toHaveBeenCalledWith(64);
    });

    it('computes non-zero RMS and peak from extracted samples', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      extract.mockImplementation(
        (buf: Float32Array, _: number, count: number) => {
          for (let i = 0; i < count; i++) {
            buf[i * 2] = 0.5;
            buf[i * 2 + 1] = 0.5;
          }
        },
      );
      const left = new Float32Array(128);
      const right = new Float32Array(128);
      const result = proc['extractSamples'](left, right, 128, 128, makeParams());
      expect(result.outputRms).toBeGreaterThan(0);
      expect(result.outputPeak).toBeCloseTo(0.5);
    });

    it('fills silence for frames beyond toExtract', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      const left = new Float32Array(128).fill(1);
      const right = new Float32Array(128).fill(1);
      proc['extractSamples'](left, right, 128, 64, makeParams());
      // Frames 64–127 should be zeroed
      expect(left[64]).toBe(0);
      expect(left[127]).toBe(0);
    });

    it('clamps NaN/Infinity samples to 0', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      extract.mockImplementation((buf: Float32Array) => {
        buf[0] = Infinity;
        buf[1] = NaN;
      });
      const left = new Float32Array(128);
      const right = new Float32Array(128);
      proc['extractSamples'](left, right, 128, 1, makeParams());
      expect(left[0]).toBe(0);
      expect(right[0]).toBe(0);
    });
  });

  describe('process (default implementation)', () => {
    it('returns true always', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      const result = proc.process([], makeOutputs(), makeParams());
      expect(result).toBe(true);
    });

    it('calls onProcessComplete with the result when processCore succeeds', () => {
      const { TestProcessor, onProcessComplete } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      outputFrameCount = 128;
      proc.process(makeInputs(), makeOutputs(), makeParams());
      expect(onProcessComplete).toHaveBeenCalledOnce();
      expect(onProcessComplete).toHaveBeenCalledWith(
        expect.objectContaining({ frameCount: 128, available: 128 }),
      );
    });

    it('does not call onProcessComplete when processCore returns null', () => {
      const { TestProcessor, onProcessComplete } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      proc.process([], makeOutputs(), makeParams());
      expect(onProcessComplete).not.toHaveBeenCalled();
    });
  });

  describe('beforePipeProcess (default hook)', () => {
    it('is a no-op and does not throw', () => {
      const { TestProcessor } = makeConcreteClass();
      const proc = new TestProcessor('[Test]', { sampleRate: 44100 });
      expect(() =>
        proc['beforePipeProcess'](
          new Float32Array(128),
          new Float32Array(128),
          128,
          makeParams(),
        ),
      ).not.toThrow();
    });
  });
});
