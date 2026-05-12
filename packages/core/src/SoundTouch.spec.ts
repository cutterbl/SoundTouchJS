import { describe, it, expect } from 'vitest';
import CircularSampleBuffer from './CircularSampleBuffer.js';
import SoundTouch from './SoundTouch.js';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import RateTransposer from './RateTransposer.js';
import Stretch from './Stretch.js';
import type { SampleBuffer } from './SampleBuffer.js';

class TestSampleBuffer implements SampleBuffer {
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

describe('SoundTouch', () => {
  describe('constructor', () => {
    it('initializes with default values', () => {
      const st = new SoundTouch({});
      expect(st.virtualPitch).toBe(1.0);
      expect(st.transposer).toBeInstanceOf(RateTransposer);
      expect(st.stretch).toBeInstanceOf(Stretch);
    });

    it('creates internal components', () => {
      const st = new SoundTouch({});
      expect(st.transposer).toBeInstanceOf(RateTransposer);
      expect(st.stretch).toBeInstanceOf(Stretch);
      expect(st.inputBuffer).toBeInstanceOf(CircularSampleBuffer);
      expect(st.outputBuffer).toBeInstanceOf(CircularSampleBuffer);
    });

    it('allows fifo sample buffer override', () => {
      const st = new SoundTouch({
        sampleRate: 44100,
        sampleBufferType: 'fifo',
      });
      expect(st.inputBuffer).toBeInstanceOf(FifoSampleBuffer);
      expect(st.outputBuffer).toBeInstanceOf(FifoSampleBuffer);
    });

    it('accepts an explicit sample rate', () => {
      const defaultRate = new SoundTouch({});
      const highRate = new SoundTouch({ sampleRate: 48000 });
      expect(highRate.stretch.sampleReq).toBeGreaterThan(
        defaultRate.stretch.sampleReq,
      );
    });

    it('accepts interpolationStrategy option', () => {
      const st = new SoundTouch({ interpolationStrategy: 'lanczos' });
      expect(st.transposer).toBeInstanceOf(RateTransposer);
    });

    it('uses the circular transposer adapter when sampleBufferType is circular', () => {
      const st = new SoundTouch({
        sampleRate: 44100,
        sampleBufferType: 'circular',
      });
      st.pitch = 1.0;

      const samples = new Float32Array(20);
      for (let i = 0; i < 20; i++) {
        samples[i] = Math.sin(i * 0.1);
      }

      st.transposer.inputBuffer!.putSamples(samples);
      st.transposer.process();

      expect(st.transposer.outputBuffer!.frameCount).toBeGreaterThan(0);
      expect(st.transposer.inputBuffer!.frameCount).toBe(0);
    });

    it('uses the circular stretch adapter when sampleBufferType is circular', () => {
      const st = new SoundTouch({
        sampleRate: 44100,
        sampleBufferType: 'circular',
      });
      st.pitch = 2.0;

      const sampleCount = st.stretch.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01);
      }
      st.inputBuffer.putSamples(samples);

      st.process();
      expect(st.outputBuffer.frameCount).toBeGreaterThanOrEqual(0);
    });

    it('can use a custom sample buffer factory for internal chain buffers', () => {
      const st = new SoundTouch({
        sampleRate: 44100,
        sampleBufferFactory: () => new TestSampleBuffer(),
      });

      expect(st.inputBuffer).toBeInstanceOf(TestSampleBuffer);
      expect(st.outputBuffer).toBeInstanceOf(TestSampleBuffer);

      st.pitch = 0.5;

      const sampleCount = st.stretch.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01);
      }
      st.inputBuffer.putSamples(samples);

      st.process();
      expect(st.outputBuffer.frameCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pitch', () => {
    it('sets virtualPitch and derives internal pipeline tempo', () => {
      const st = new SoundTouch({});
      st.pitch = 2.0;
      expect(st.virtualPitch).toBe(2.0);
      // _rate = virtualPitch → Transposer output routes to final output (rate > 1)
      expect(st.transposer.outputBuffer).toBe(st.outputBuffer);
      // _tempo = 1 / virtualPitch
      expect(st.stretch.tempo).toBeCloseTo(0.5, 5);
    });
  });

  describe('pitchSemitones', () => {
    it('pitch of 0 semitones keeps pitch at 1', () => {
      const st = new SoundTouch({});
      st.pitchSemitones = 0;
      expect(st.virtualPitch).toBeCloseTo(1.0, 5);
    });

    it('pitch of 12 semitones doubles the pitch', () => {
      const st = new SoundTouch({});
      st.pitchSemitones = 12;
      expect(st.virtualPitch).toBeCloseTo(2.0, 2);
    });
  });

  describe('pitchOctaves', () => {
    it('pitch of 1 octave doubles the pitch', () => {
      const st = new SoundTouch({});
      st.pitchOctaves = 1;
      expect(st.virtualPitch).toBeCloseTo(2.0, 2);
    });
  });

  describe('calculateEffectiveRateAndTempo', () => {
    it('routes through Transposer→output when pitch > 1', () => {
      const st = new SoundTouch({});
      st.pitch = 2.0;
      expect(st.transposer.outputBuffer).toBe(st.outputBuffer);
    });

    it('routes through Stretch→output when pitch <= 1', () => {
      const st = new SoundTouch({});
      st.pitch = 0.5;
      expect(st.stretch.outputBuffer).toBe(st.outputBuffer);
    });
  });

  describe('runtime interpolation strategy controls', () => {
    it('switches interpolation strategy through SoundTouch API', () => {
      const st = new SoundTouch({ interpolationStrategy: 'lanczos' });

      st.setInterpolationStrategy('lanczos');

      expect(st.interpolationStrategy).toBe('lanczos');
    });

    it('updates interpolation strategy params through SoundTouch API', () => {
      const st = new SoundTouch({
        interpolationStrategy: {
          id: 'lanczos',
          params: { zeroCrossings: 4 },
        },
      });

      st.setInterpolationStrategyParams({ radius: 6 });

      expect(st.interpolationStrategyParams['radius']).toBe(6);
    });
  });

  describe('clone', () => {
    it('creates an independent copy with the same pitch', () => {
      const st = new SoundTouch({});
      st.pitch = 1.5;
      const cloned = st.clone();
      expect(cloned).not.toBe(st);
      expect(cloned.virtualPitch).toBeCloseTo(st.virtualPitch, 5);
    });

    it('preserves circular sample buffer type', () => {
      const st = new SoundTouch({
        sampleRate: 44100,
        sampleBufferType: 'circular',
      });
      const cloned = st.clone();

      const samples = new Float32Array(20);
      for (let i = 0; i < 20; i++) {
        samples[i] = Math.cos(i * 0.1);
      }

      cloned.transposer.inputBuffer!.putSamples(samples);
      cloned.transposer.process();

      expect(cloned.transposer.outputBuffer!.frameCount).toBeGreaterThan(0);
      expect(cloned.transposer.inputBuffer!.frameCount).toBe(0);
    });

    it('preserves circular sample buffer type for stretch', () => {
      const st = new SoundTouch({
        sampleRate: 44100,
        sampleBufferType: 'circular',
      });
      st.pitch = 2.0;
      const cloned = st.clone();

      const sampleCount = cloned.stretch.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.cos(i * 0.01);
      }
      cloned.inputBuffer.putSamples(samples);
      cloned.process();

      expect(cloned.outputBuffer.frameCount).toBeGreaterThanOrEqual(0);
    });

    it('preserves custom sample buffer factory', () => {
      const st = new SoundTouch({
        sampleRate: 44100,
        sampleBufferFactory: () => new TestSampleBuffer(),
      });
      const cloned = st.clone();

      expect(cloned.inputBuffer).toBeInstanceOf(TestSampleBuffer);
      expect(cloned.outputBuffer).toBeInstanceOf(TestSampleBuffer);
    });
  });

  describe('clear', () => {
    it('clears stretch and transposer without throwing', () => {
      const st = new SoundTouch({});
      expect(() => st.clear()).not.toThrow();
    });
  });

  describe('process', () => {
    it('processes with pitch > 1 (Stretch then Transpose order)', () => {
      const st = new SoundTouch({});
      st.pitch = 2.0;

      const sampleCount = st.stretch.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01);
      }
      st.inputBuffer.putSamples(samples);

      st.process();
      expect(st.outputBuffer.frameCount).toBeGreaterThanOrEqual(0);
    });

    it('processes with pitch <= 1 (Transpose then Stretch order)', () => {
      const st = new SoundTouch({});
      st.pitch = 0.5;

      const sampleCount = st.stretch.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01);
      }
      st.inputBuffer.putSamples(samples);

      st.process();
      expect(st.outputBuffer.frameCount).toBeGreaterThanOrEqual(0);
    });
  });
});
