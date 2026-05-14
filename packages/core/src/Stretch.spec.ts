import { describe, it, expect } from 'vitest';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import type { SampleBuffer } from './SampleBuffer.js';
import Stretch, { createCircularStretchInputBufferAdapter } from './Stretch.js';

class TestSampleBuffer implements SampleBuffer {
  private readonly samples: Float32Array;
  private consumedFrames: number;

  constructor(samples: Float32Array) {
    this.samples = samples;
    this.consumedFrames = 0;
  }

  get frameCount(): number {
    return Math.max(0, this.samples.length / 2 - this.consumedFrames);
  }

  clear(): void {
    this.consumedFrames = this.samples.length / 2;
  }

  putSamples(
    _samples: Float32Array,
    _position?: number,
    _numFrames?: number,
  ): void {
    throw new Error('not implemented for test');
  }

  extract(output: Float32Array, position = 0, numFrames = 0): void {
    const available = Math.max(0, this.frameCount - position);
    const framesToCopy =
      numFrames > 0 ? Math.min(numFrames, available) : available;
    const sourceFrame = this.consumedFrames + position;
    const start = sourceFrame * 2;
    const end = start + framesToCopy * 2;
    output.set(this.samples.subarray(start, end), 0);
  }

  receive(numFrames = this.frameCount): void {
    this.consumedFrames = Math.min(
      this.consumedFrames + numFrames,
      this.samples.length / 2,
    );
  }
}

class TestWritableSampleBuffer implements SampleBuffer {
  private samples: Float32Array;
  private _frameCount: number;

  constructor() {
    this.samples = new Float32Array(0);
    this._frameCount = 0;
  }

  get frameCount(): number {
    return this._frameCount;
  }

  clear(): void {
    this.samples = new Float32Array(0);
    this._frameCount = 0;
  }

  putSamples(input: Float32Array, position = 0, numFrames = 0): void {
    const sourceOffset = position * 2;
    const framesToWrite =
      numFrames > 0 ? numFrames : Math.floor((input.length - sourceOffset) / 2);
    const sampleCount = framesToWrite * 2;

    const next = new Float32Array(this.samples.length + sampleCount);
    next.set(this.samples, 0);
    next.set(
      input.subarray(sourceOffset, sourceOffset + sampleCount),
      this.samples.length,
    );
    this.samples = next;
    this._frameCount += framesToWrite;
  }

  extract(output: Float32Array, position = 0, numFrames = 0): void {
    const framesToRead =
      numFrames > 0 ? numFrames : this._frameCount - position;
    const sourceOffset = position * 2;
    const sampleCount = Math.max(0, framesToRead) * 2;
    output.set(
      this.samples.subarray(sourceOffset, sourceOffset + sampleCount),
      0,
    );
  }

  receive(numFrames = this._frameCount): void {
    const framesToDrop = Math.min(Math.max(0, numFrames), this._frameCount);
    const sampleOffset = framesToDrop * 2;
    this.samples = this.samples.subarray(sampleOffset);
    this._frameCount -= framesToDrop;
  }
}

describe('Stretch', () => {
  function fillStereoSine(
    target: Float32Array,
    frameOffset = 0,
    phaseStep = 0.07,
  ): void {
    for (let frame = 0; frame < target.length / 2; frame++) {
      const phase = (frame + frameOffset) * phaseStep;
      target[2 * frame] = Math.sin(phase);
      target[2 * frame + 1] = Math.cos(phase * 0.9);
    }
  }

  describe('constructor', () => {
    it('creates with default tempo of 1', () => {
      const s = new Stretch({ createBuffers: true });
      expect(s.tempo).toBe(1);
    });

    it('initializes overlap length from default parameters', () => {
      const s = new Stretch({ createBuffers: true });
      expect(s.overlapLength).toBeGreaterThan(0);
    });
  });

  describe('tempo setter', () => {
    it('updates tempo and recalculates parameters', () => {
      const s = new Stretch({ createBuffers: true });
      s.tempo = 2.0;
      expect(s.tempo).toBe(2.0);
      expect(s.sampleReq).toBeGreaterThan(0);
    });
  });

  describe('setParameters', () => {
    it('allows custom sample rate and timing', () => {
      const s = new Stretch({ createBuffers: true });
      s.setParameters(48000, 40, 15, 12);
      expect(s.sequenceMs).toBe(40);
      expect(s.seekWindowMs).toBe(15);
    });

    it('uses auto settings when sequence/seek are 0', () => {
      const s = new Stretch({ createBuffers: true });
      s.setParameters(44100, 0, 0, 8);
      expect(s.sequenceMs).toBeGreaterThan(0);
      expect(s.seekWindowMs).toBeGreaterThan(0);
    });
  });

  describe('inputChunkSize / outputChunkSize', () => {
    it('returns positive values', () => {
      const s = new Stretch({ createBuffers: true });
      s.tempo = 1.5;
      expect(s.inputChunkSize).toBeGreaterThan(0);
      expect(s.outputChunkSize).toBeGreaterThan(0);
    });
  });

  describe('clone', () => {
    it('creates an independent copy', () => {
      const s = new Stretch({ createBuffers: true });
      s.tempo = 1.5;
      const cloned = s.clone();
      expect(cloned).not.toBe(s);
      expect(cloned.tempo).toBe(1.5);
    });

    it('preserves the circular sample buffer strategy in clones', () => {
      const s = new Stretch({
        createBuffers: true,
        inputBufferAdapterFactory: createCircularStretchInputBufferAdapter,
      });
      s.tempo = 1.0;
      const cloned = s.clone();
      cloned.inputBuffer = new FifoSampleBuffer();
      cloned.outputBuffer = new FifoSampleBuffer();

      const sampleCount = cloned.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.cos(i * 0.01);
      }
      cloned.inputBuffer!.putSamples(samples);
      cloned.process();

      expect(cloned.outputBuffer!.frameCount).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('zeros mid buffer and marks dirty', () => {
      const s = new Stretch({ createBuffers: true });
      s.midBuffer = new Float32Array([1, 2, 3, 4]);
      s.clear();
      expect(s.midBuffer.every((v) => v === 0)).toBe(true);
    });

    it('resets buffers', () => {
      const s = new Stretch({ createBuffers: true });
      s.inputBuffer!.putSamples(new Float32Array([1, 2, 3, 4]));
      s.clear();
      expect(s.inputBuffer!.frameCount).toBe(0);
    });
  });

  describe('process', () => {
    it('throws when processing without an input buffer', () => {
      const s = new Stretch({ createBuffers: false });

      expect(() => s.process()).toThrow('inputBuffer is not set');
    });

    it('throws when processing without an output buffer', () => {
      const s = new Stretch({ createBuffers: false });
      s.inputBuffer = new FifoSampleBuffer();

      expect(() => s.process()).toThrow('outputBuffer is not set');
    });

    it('returns early when midBuffer is null and insufficient input', () => {
      const s = new Stretch({ createBuffers: true });
      s.tempo = 1.0;
      s.inputBuffer!.putSamples(new Float32Array(4));
      s.process();
      expect(s.outputBuffer!.frameCount).toBe(0);
    });

    it('produces output when given enough input data', () => {
      const s = new Stretch({ createBuffers: true });
      s.tempo = 1.0;

      const sampleCount = s.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01);
      }
      s.inputBuffer!.putSamples(samples);

      s.process();
      expect(s.outputBuffer!.frameCount).toBeGreaterThan(0);
    });

    it('produces output with the circular sample buffer strategy', () => {
      const s = new Stretch({
        createBuffers: true,
        inputBufferAdapterFactory: createCircularStretchInputBufferAdapter,
      });
      s.tempo = 1.0;

      const sampleCount = s.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01);
      }
      s.inputBuffer!.putSamples(samples);

      s.process();
      expect(s.outputBuffer!.frameCount).toBeGreaterThan(0);
    });

    it('consumes non-fifo input through the circular sample buffer strategy', () => {
      const s = new Stretch({
        createBuffers: false,
        inputBufferAdapterFactory: createCircularStretchInputBufferAdapter,
      });
      s.tempo = 1.0;

      const sampleCount = s.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01);
      }

      const input = new TestSampleBuffer(samples);
      s.inputBuffer = input;
      s.outputBuffer = new FifoSampleBuffer();

      s.process();

      expect(input.frameCount).toBeLessThan(sampleCount);
      expect(s.outputBuffer!.frameCount).toBeGreaterThan(0);
    });

    it('writes to non-fifo output buffer through sample buffer contract', () => {
      const s = new Stretch({
        createBuffers: false,
        inputBufferAdapterFactory: createCircularStretchInputBufferAdapter,
      });
      s.tempo = 1.0;

      const sampleCount = s.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.cos(i * 0.01);
      }

      s.inputBuffer = new TestSampleBuffer(samples);
      s.outputBuffer = new TestWritableSampleBuffer();

      s.process();

      expect(s.outputBuffer!.frameCount).toBeGreaterThan(0);
    });
  });

  describe('seekBestOverlapPosition', () => {
    it('returns a non-negative offset', () => {
      const s = new Stretch({ createBuffers: true });
      s.tempo = 1.0;

      const sampleCount = s.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01);
      }
      s.inputBuffer!.putSamples(samples);

      s.midBuffer = new Float32Array(s.overlapLength * 2);
      for (let i = 0; i < s.midBuffer.length; i++) {
        s.midBuffer[i] = Math.sin(i * 0.01);
      }

      const offset = s.seekBestOverlapPosition();
      const { seekLength } = s as unknown as { seekLength: number };
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(seekLength);
    });

    it('uses the non-quick seek path when quickSeek is disabled', () => {
      const s = new Stretch({ createBuffers: true });
      s.quickSeek = false;
      s.tempo = 1.0;

      const sampleCount = s.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.cos(i * 0.01);
      }
      s.inputBuffer!.putSamples(samples);

      s.midBuffer = new Float32Array(s.overlapLength * 2);
      for (let i = 0; i < s.midBuffer.length; i++) {
        s.midBuffer[i] = Math.cos(i * 0.02);
      }

      const offset = s.seekBestOverlapPosition();
      const { seekLength } = s as unknown as { seekLength: number };
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(seekLength);
    });

    it('keeps quick-seek offsets valid on tiny seek windows', () => {
      const s = new Stretch({ createBuffers: true });
      s.quickSeek = true;
      s.setParameters(44100, 25, 1, 8);
      s.tempo = 1.0;

      const sampleCount = s.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.03);
      }
      s.inputBuffer!.putSamples(samples);

      s.midBuffer = new Float32Array(s.overlapLength * 2);
      for (let i = 0; i < s.midBuffer.length; i++) {
        s.midBuffer[i] = Math.cos(i * 0.02);
      }

      const offset = s.seekBestOverlapPosition();
      const { seekLength } = s as unknown as { seekLength: number };
      expect(Number.isFinite(offset)).toBe(true);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(seekLength);
    });

    it('falls back to full seek for small seek windows', () => {
      const full = new Stretch({ createBuffers: true });
      full.quickSeek = false;
      full.setParameters(44100, 25, 1, 8);
      full.tempo = 1.0;

      const quick = new Stretch({ createBuffers: true });
      quick.quickSeek = true;
      quick.setParameters(44100, 25, 1, 8);
      quick.tempo = 1.0;

      const sampleCount = quick.sampleReq * 6;
      const samples = new Float32Array(sampleCount * 2);
      fillStereoSine(samples, 0, 0.05);
      full.inputBuffer!.putSamples(samples);
      quick.inputBuffer!.putSamples(samples);

      const knownOffset = 17;
      const mid = new Float32Array(quick.overlapLength * 2);
      fillStereoSine(mid, knownOffset, 0.05);
      full.midBuffer = mid.slice();
      quick.midBuffer = mid.slice();

      const fullOffset = full.seekBestOverlapPosition();
      const quickOffset = quick.seekBestOverlapPosition();

      expect(quickOffset).toBe(fullOffset);
    });

    it('finds a known best overlap offset on deterministic input', () => {
      const s = new Stretch({ createBuffers: true });
      s.quickSeek = false;
      s.setParameters(44100, 25, 10, 8);
      s.tempo = 1.0;

      const knownOffset = 24;
      const inputFrames = 240;
      const input = new Float32Array(inputFrames * 2);
      fillStereoSine(input, 0);
      s.inputBuffer!.putSamples(input);

      s.midBuffer = new Float32Array(s.overlapLength * 2);
      fillStereoSine(s.midBuffer, knownOffset);

      const offset = s.seekBestOverlapPosition();
      expect(Math.abs(offset - knownOffset)).toBeLessThanOrEqual(1);
    });

    it('keeps quick seek close to full seek on deterministic input', () => {
      const full = new Stretch({ createBuffers: true });
      full.quickSeek = false;
      full.setParameters(44100, 25, 20, 8);
      full.tempo = 1.0;

      const quick = new Stretch({ createBuffers: true });
      quick.quickSeek = true;
      quick.setParameters(44100, 25, 20, 8);
      quick.tempo = 1.0;

      const inputFrames = 1024;
      const input = new Float32Array(inputFrames * 2);
      fillStereoSine(input, 0, 0.04);
      full.inputBuffer!.putSamples(input);
      quick.inputBuffer!.putSamples(input);

      const mid = new Float32Array(full.overlapLength * 2);
      const knownOffset = 124;
      fillStereoSine(mid, knownOffset, 0.04);
      full.midBuffer = mid.slice();
      quick.midBuffer = mid.slice();

      const fullOffset = full.seekBestOverlapPosition();
      const quickOffset = quick.seekBestOverlapPosition();

      expect(Math.abs(fullOffset - knownOffset)).toBeLessThanOrEqual(1);
      expect(Math.abs(quickOffset - fullOffset)).toBeLessThanOrEqual(4);
    });

    it('keeps quick seek near full seek on medium seek windows', () => {
      const full = new Stretch({ createBuffers: true });
      full.quickSeek = false;
      full.setParameters(44100, 25, 8, 8);
      full.tempo = 1.0;

      const quick = new Stretch({ createBuffers: true });
      quick.quickSeek = true;
      quick.setParameters(44100, 25, 8, 8);
      quick.tempo = 1.0;

      const inputFrames = 900;
      const input = new Float32Array(inputFrames * 2);
      fillStereoSine(input, 0, 0.037);
      full.inputBuffer!.putSamples(input);
      quick.inputBuffer!.putSamples(input);

      const knownOffset = 78;
      const mid = new Float32Array(full.overlapLength * 2);
      fillStereoSine(mid, knownOffset, 0.037);
      full.midBuffer = mid.slice();
      quick.midBuffer = mid.slice();

      const fullOffset = full.seekBestOverlapPosition();
      const quickOffset = quick.seekBestOverlapPosition();

      expect(Math.abs(fullOffset - knownOffset)).toBeLessThanOrEqual(2);
      expect(Math.abs(quickOffset - fullOffset)).toBeLessThanOrEqual(12);
    });

    it('can select zero offset in quick mode when alignment starts at window origin', () => {
      const full = new Stretch({ createBuffers: true });
      full.quickSeek = false;
      full.setParameters(44100, 25, 8, 8);
      full.tempo = 1.0;

      const quick = new Stretch({ createBuffers: true });
      quick.quickSeek = true;
      quick.setParameters(44100, 25, 8, 8);
      quick.tempo = 1.0;

      const inputFrames = 1200;
      const samples = new Float32Array(inputFrames * 2);
      for (let i = 0; i < quick.overlapLength * 2; i++) {
        samples[i] = Math.sin(i * 0.11);
      }

      full.inputBuffer!.putSamples(samples);
      quick.inputBuffer!.putSamples(samples);

      const mid = samples.subarray(0, quick.overlapLength * 2).slice();
      full.midBuffer = mid.slice();
      quick.midBuffer = mid.slice();

      const fullOffset = full.seekBestOverlapPosition();
      const quickOffset = quick.seekBestOverlapPosition();

      const seekLength = Math.floor((44100 * 8) / 1000);
      expect(quickOffset).toBeGreaterThanOrEqual(0);
      expect(quickOffset).toBeLessThan(seekLength);
      expect(fullOffset).toBeGreaterThanOrEqual(0);
      expect(fullOffset).toBeLessThan(seekLength);
      expect(Math.abs(quickOffset - fullOffset)).toBeLessThanOrEqual(32);
    });
  });

  describe('numerical stability', () => {
    it('produces finite output samples on small seek windows', () => {
      const s = new Stretch({ createBuffers: true });
      s.quickSeek = true;
      s.setParameters(44100, 25, 1, 8);
      s.tempo = 1.0;

      const sampleCount = s.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01) * (1 - i / samples.length);
      }

      s.inputBuffer!.putSamples(samples);
      s.process();

      const output = s.outputBuffer! as FifoSampleBuffer;
      const outputStart = output.startIndex;
      const outputEnd = output.endIndex;
      const written = output.vector.subarray(outputStart, outputEnd);
      expect(written.length).toBeGreaterThan(0);
      expect(Array.from(written).every(Number.isFinite)).toBe(true);
    });

    it('tracks expected long-run output/input frame ratio', () => {
      const s = new Stretch({ createBuffers: true });
      s.quickSeek = true;
      s.setParameters(44100, 40, 15, 8);
      s.tempo = 1.35;

      const inputFrames = s.sampleReq * 96;
      const samples = new Float32Array(inputFrames * 2);
      fillStereoSine(samples, 0, 0.031);
      s.inputBuffer!.putSamples(samples);

      s.process();

      const inputConsumed = inputFrames - s.inputBuffer!.frameCount;
      const outputFrames = s.outputBuffer!.frameCount;
      expect(inputConsumed).toBeGreaterThan(0);
      expect(outputFrames).toBeGreaterThan(0);

      const observedRatio = outputFrames / inputConsumed;
      const expectedRatio = 1 / s.tempo;
      expect(Math.abs(observedRatio - expectedRatio)).toBeLessThanOrEqual(0.12);
    });
  });

  describe('quickSeek setter', () => {
    it('can be toggled without error', () => {
      const s = new Stretch({ createBuffers: true });
      expect(() => {
        s.quickSeek = false;
      }).not.toThrow();
      expect(() => {
        s.quickSeek = true;
      }).not.toThrow();
    });
  });
});

describe('quick seek behavior across seek windows', () => {
  it('keeps quick-seek offsets bounded for multiple window sizes', () => {
    function fillStereoSineLocal(
      target: Float32Array,
      frameOffset = 0,
      phaseStep = 0.041,
    ): void {
      for (let frame = 0; frame < target.length / 2; frame++) {
        const phase = (frame + frameOffset) * phaseStep;
        target[2 * frame] = Math.sin(phase);
        target[2 * frame + 1] = Math.cos(phase * 0.9);
      }
    }

    const sampleRate = 44100;
    const sequenceMs = 25;
    const overlapMs = 8;

    for (const seekWindowMs of [2, 4, 8, 12, 20]) {
      const full = new Stretch({ createBuffers: true });
      full.quickSeek = false;
      full.setParameters(sampleRate, sequenceMs, seekWindowMs, overlapMs);
      full.tempo = 1.0;

      const quick = new Stretch({ createBuffers: true });
      quick.quickSeek = true;
      quick.setParameters(sampleRate, sequenceMs, seekWindowMs, overlapMs);
      quick.tempo = 1.0;

      const inputFrames = Math.max(1024, quick.sampleReq * 6);
      const input = new Float32Array(inputFrames * 2);
      fillStereoSineLocal(input, 0, 0.041);
      full.inputBuffer!.putSamples(input);
      quick.inputBuffer!.putSamples(input);

      const knownOffset = Math.max(
        0,
        Math.floor((sampleRate * seekWindowMs) / 3000),
      );
      const mid = new Float32Array(quick.overlapLength * 2);
      fillStereoSineLocal(mid, knownOffset, 0.041);
      full.midBuffer = mid.slice();
      quick.midBuffer = mid.slice();

      const fullOffset = full.seekBestOverlapPosition();
      const quickOffset = quick.seekBestOverlapPosition();
      const seekLength = Math.max(
        1,
        Math.floor((sampleRate * seekWindowMs) / 1000),
      );

      expect(fullOffset).toBeGreaterThanOrEqual(0);
      expect(fullOffset).toBeLessThan(seekLength);
      expect(quickOffset).toBeGreaterThanOrEqual(0);
      expect(quickOffset).toBeLessThan(seekLength);

      expect(Number.isFinite(fullOffset)).toBe(true);
      expect(Number.isFinite(quickOffset)).toBe(true);
    }
  });

  describe('overlapMs getter/setter', () => {
    it('getter returns the current overlap period', () => {
      const s = new Stretch({ createBuffers: true });
      s.setParameters(44100, 0, 0, 12);
      expect(s.overlapMs).toBe(12);
    });

    it('setter updates overlap length and recalculates derived params', () => {
      const s = new Stretch({ createBuffers: true });
      const prevOverlapLength = s.overlapLength;
      s.overlapMs = 16;
      expect(s.overlapMs).toBe(16);
      expect(s.overlapLength).toBeGreaterThan(0);
      expect(s.overlapLength).not.toBe(prevOverlapLength);
      expect(s.sampleReq).toBeGreaterThan(0);
    });

    it('setter ignores zero or negative values', () => {
      const s = new Stretch({ createBuffers: true });
      const before = s.overlapMs;
      s.overlapMs = 0;
      expect(s.overlapMs).toBe(before);
    });
  });

  describe('quickSeek getter', () => {
    it('returns true by default', () => {
      const s = new Stretch({ createBuffers: true });
      expect(s.quickSeek).toBe(true);
    });

    it('reflects setter changes', () => {
      const s = new Stretch({ createBuffers: true });
      s.quickSeek = false;
      expect(s.quickSeek).toBe(false);
    });
  });

  describe('setStretchParameters', () => {
    it('sets sequenceMs to a manual value', () => {
      const s = new Stretch({ createBuffers: true });
      s.setStretchParameters({ sequenceMs: 80 });
      expect(s.sequenceMs).toBe(80);
    });

    it('switching sequenceMs to 0 re-enables auto', () => {
      const s = new Stretch({ createBuffers: true });
      s.setStretchParameters({ sequenceMs: 80 });
      expect(s.sequenceMs).toBe(80);
      s.setStretchParameters({ sequenceMs: 0 });
      expect(s.sequenceMs).toBeGreaterThan(0);
      expect(s.sequenceMs).not.toBe(80);
    });

    it('sets seekWindowMs to a manual value', () => {
      const s = new Stretch({ createBuffers: true });
      s.setStretchParameters({ seekWindowMs: 20 });
      expect(s.seekWindowMs).toBe(20);
    });

    it('sets overlapMs and recalculates overlap length', () => {
      const s = new Stretch({ createBuffers: true });
      s.setStretchParameters({ overlapMs: 14 });
      expect(s.overlapMs).toBe(14);
      expect(s.overlapLength).toBeGreaterThan(0);
    });

    it('sets quickSeek flag', () => {
      const s = new Stretch({ createBuffers: true });
      s.setStretchParameters({ quickSeek: false });
      expect(s.quickSeek).toBe(false);
    });

    it('does not recalculate when only quickSeek changes', () => {
      const s = new Stretch({ createBuffers: true });
      const prevReq = s.sampleReq;
      s.setStretchParameters({ quickSeek: false });
      expect(s.sampleReq).toBe(prevReq);
    });

    it('leaves unchanged params untouched', () => {
      const s = new Stretch({ createBuffers: true });
      const prevSeek = s.seekWindowMs;
      s.setStretchParameters({ sequenceMs: 70 });
      expect(s.seekWindowMs).toBe(prevSeek);
    });
  });
});
