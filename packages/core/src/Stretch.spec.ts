import { describe, it, expect } from 'vitest';
import Stretch from './Stretch.js';

describe('Stretch', () => {
  describe('constructor', () => {
    it('creates with default tempo of 1', () => {
      const s = new Stretch(true);
      expect(s.tempo).toBe(1);
    });

    it('initializes overlap length from default parameters', () => {
      const s = new Stretch(true);
      expect(s.overlapLength).toBeGreaterThan(0);
    });
  });

  describe('tempo setter', () => {
    it('updates tempo and recalculates parameters', () => {
      const s = new Stretch(true);
      s.tempo = 2.0;
      expect(s.tempo).toBe(2.0);
      expect(s.sampleReq).toBeGreaterThan(0);
    });
  });

  describe('setParameters', () => {
    it('allows custom sample rate and timing', () => {
      const s = new Stretch(true);
      s.setParameters(48000, 40, 15, 12);
      expect(s.sequenceMs).toBe(40);
      expect(s.seekWindowMs).toBe(15);
    });

    it('uses auto settings when sequence/seek are 0', () => {
      const s = new Stretch(true);
      s.setParameters(44100, 0, 0, 8);
      expect(s.sequenceMs).toBeGreaterThan(0);
      expect(s.seekWindowMs).toBeGreaterThan(0);
    });
  });

  describe('inputChunkSize / outputChunkSize', () => {
    it('returns positive values', () => {
      const s = new Stretch(true);
      s.tempo = 1.5;
      expect(s.inputChunkSize).toBeGreaterThan(0);
      expect(s.outputChunkSize).toBeGreaterThan(0);
    });
  });

  describe('clone', () => {
    it('creates an independent copy', () => {
      const s = new Stretch(true);
      s.tempo = 1.5;
      const cloned = s.clone();
      expect(cloned).not.toBe(s);
      expect(cloned.tempo).toBe(1.5);
    });
  });

  describe('clear', () => {
    it('resets mid buffer state', () => {
      const s = new Stretch(true);
      s.midBuffer = new Float32Array(100);
      s.clear();
      expect(s.midBuffer).toBeNull();
    });

    it('resets buffers', () => {
      const s = new Stretch(true);
      s.inputBuffer!.putSamples(new Float32Array([1, 2, 3, 4]));
      s.clear();
      expect(s.inputBuffer!.frameCount).toBe(0);
    });
  });

  describe('process', () => {
    it('returns early when midBuffer is null and insufficient input', () => {
      const s = new Stretch(true);
      s.tempo = 1.0;
      s.inputBuffer!.putSamples(new Float32Array(4));
      s.process();
      expect(s.outputBuffer!.frameCount).toBe(0);
    });

    it('produces output when given enough input data', () => {
      const s = new Stretch(true);
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
  });

  describe('seekBestOverlapPosition', () => {
    it('returns a non-negative offset', () => {
      const s = new Stretch(true);
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
      expect(offset).toBeGreaterThanOrEqual(0);
    });
  });

  describe('quickSeek setter', () => {
    it('can be toggled without error', () => {
      const s = new Stretch(true);
      expect(() => {
        s.quickSeek = false;
      }).not.toThrow();
      expect(() => {
        s.quickSeek = true;
      }).not.toThrow();
    });
  });
});
