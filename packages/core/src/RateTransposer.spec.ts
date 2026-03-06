import { describe, it, expect } from 'vitest';
import RateTransposer from './RateTransposer.js';

describe('RateTransposer', () => {
  describe('constructor', () => {
    it('creates with buffers when requested', () => {
      const rt = new RateTransposer(true);
      expect(rt.inputBuffer).not.toBeNull();
      expect(rt.outputBuffer).not.toBeNull();
    });

    it('creates without buffers by default', () => {
      const rt = new RateTransposer();
      expect(rt.inputBuffer).toBeNull();
      expect(rt.outputBuffer).toBeNull();
    });
  });

  describe('rate setter', () => {
    it('accepts a rate value without throwing', () => {
      const rt = new RateTransposer(true);
      expect(() => {
        rt.rate = 2.0;
      }).not.toThrow();
    });
  });

  describe('clone', () => {
    it('produces a new independent instance', () => {
      const rt = new RateTransposer(true);
      rt.rate = 1.5;
      const cloned = rt.clone();
      expect(cloned).not.toBe(rt);
      expect(cloned).toBeInstanceOf(RateTransposer);
    });
  });

  describe('clear', () => {
    it('resets internal state and buffers', () => {
      const rt = new RateTransposer(true);
      rt.inputBuffer!.putSamples(new Float32Array([1, 2, 3, 4]));
      rt.clear();
      expect(rt.inputBuffer!.frameCount).toBe(0);
      expect(rt.outputBuffer!.frameCount).toBe(0);
    });
  });

  describe('transpose', () => {
    it('returns 0 for 0 input frames', () => {
      const rt = new RateTransposer(true);
      rt.rate = 1.0;
      expect(rt.transpose(0)).toBe(0);
    });

    it('produces output frames at rate 1.0', () => {
      const rt = new RateTransposer(true);
      rt.rate = 1.0;

      const samples = new Float32Array(20);
      for (let i = 0; i < 20; i++) {
        samples[i] = i;
      }
      rt.inputBuffer!.putSamples(samples);
      rt.outputBuffer!.ensureCapacity(20);

      const numOut = rt.transpose(10);
      expect(numOut).toBeGreaterThan(0);
    });

    it('produces fewer frames when rate > 1', () => {
      const rt1 = new RateTransposer(true);
      rt1.rate = 1.0;
      const samples1 = new Float32Array(40);
      for (let i = 0; i < 40; i++) samples1[i] = Math.sin(i * 0.1);
      rt1.inputBuffer!.putSamples(samples1);
      rt1.outputBuffer!.ensureCapacity(40);
      const out1 = rt1.transpose(20);

      const rt2 = new RateTransposer(true);
      rt2.rate = 2.0;
      const samples2 = new Float32Array(40);
      for (let i = 0; i < 40; i++) samples2[i] = Math.sin(i * 0.1);
      rt2.inputBuffer!.putSamples(samples2);
      rt2.outputBuffer!.ensureCapacity(40);
      const out2 = rt2.transpose(20);

      expect(out2).toBeLessThan(out1);
    });
  });

  describe('process', () => {
    it('moves data from input to output buffer', () => {
      const rt = new RateTransposer(true);
      rt.rate = 1.0;

      const samples = new Float32Array(20);
      for (let i = 0; i < 20; i++) samples[i] = i * 0.1;
      rt.inputBuffer!.putSamples(samples);

      rt.process();
      expect(rt.outputBuffer!.frameCount).toBeGreaterThan(0);
      expect(rt.inputBuffer!.frameCount).toBe(0);
    });
  });
});
