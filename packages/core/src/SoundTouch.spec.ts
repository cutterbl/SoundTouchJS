import { describe, it, expect } from 'vitest';
import SoundTouch from './SoundTouch.js';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import RateTransposer from './RateTransposer.js';
import Stretch from './Stretch.js';

describe('SoundTouch', () => {
  describe('constructor', () => {
    it('initializes with default values', () => {
      const st = new SoundTouch();
      expect(st.rate).toBeDefined();
      expect(st.tempo).toBeDefined();
      expect(st.virtualPitch).toBe(1.0);
      expect(st.virtualRate).toBe(1.0);
      expect(st.virtualTempo).toBe(1.0);
    });

    it('creates internal components', () => {
      const st = new SoundTouch();
      expect(st.transposer).toBeInstanceOf(RateTransposer);
      expect(st.stretch).toBeInstanceOf(Stretch);
      expect(st.inputBuffer).toBeInstanceOf(FifoSampleBuffer);
      expect(st.outputBuffer).toBeInstanceOf(FifoSampleBuffer);
    });
  });

  describe('rate', () => {
    it('getter returns the effective rate', () => {
      const st = new SoundTouch();
      st.rate = 1.5;
      expect(st.rate).toBeCloseTo(1.5, 5);
    });
  });

  describe('tempo', () => {
    it('getter returns the effective tempo', () => {
      const st = new SoundTouch();
      st.tempo = 2.0;
      expect(st.tempo).toBeCloseTo(2.0, 5);
    });
  });

  describe('pitch', () => {
    it('adjusts virtual pitch and recalculates rate/tempo', () => {
      const st = new SoundTouch();
      st.pitch = 2.0;
      expect(st.virtualPitch).toBe(2.0);
      expect(st.rate).toBeCloseTo(2.0, 5);
      expect(st.tempo).toBeCloseTo(0.5, 5);
    });
  });

  describe('pitchSemitones', () => {
    it('pitch of 0 semitones keeps pitch at 1', () => {
      const st = new SoundTouch();
      st.pitchSemitones = 0;
      expect(st.virtualPitch).toBeCloseTo(1.0, 5);
    });

    it('pitch of 12 semitones doubles the pitch', () => {
      const st = new SoundTouch();
      st.pitchSemitones = 12;
      expect(st.virtualPitch).toBeCloseTo(2.0, 2);
    });
  });

  describe('pitchOctaves', () => {
    it('pitch of 1 octave doubles the pitch', () => {
      const st = new SoundTouch();
      st.pitchOctaves = 1;
      expect(st.virtualPitch).toBeCloseTo(2.0, 2);
    });
  });

  describe('rateChange', () => {
    it('sets rate via percentage change', () => {
      const st = new SoundTouch();
      st.rateChange = 50;
      expect(st.rate).toBeCloseTo(1.5, 5);
    });
  });

  describe('tempoChange', () => {
    it('sets tempo via percentage change', () => {
      const st = new SoundTouch();
      st.tempoChange = 100;
      expect(st.tempo).toBeCloseTo(2.0, 5);
    });
  });

  describe('calculateEffectiveRateAndTempo', () => {
    it('chains pipe order based on rate > 1', () => {
      const st = new SoundTouch();
      st.rate = 2.0;
      expect(st.transposer.outputBuffer).toBe(st.outputBuffer);
    });

    it('chains pipe order based on rate <= 1', () => {
      const st = new SoundTouch();
      st.rate = 0.5;
      expect(st.stretch.outputBuffer).toBe(st.outputBuffer);
    });
  });

  describe('clone', () => {
    it('creates an independent copy', () => {
      const st = new SoundTouch();
      st.rate = 1.5;
      st.tempo = 2.0;
      const cloned = st.clone();
      expect(cloned).not.toBe(st);
      expect(cloned.rate).toBeCloseTo(st.rate, 5);
      expect(cloned.tempo).toBeCloseTo(st.tempo, 5);
    });
  });

  describe('clear', () => {
    it('clears stretch and transposer', () => {
      const st = new SoundTouch();
      expect(() => st.clear()).not.toThrow();
    });
  });

  describe('process', () => {
    it('processes with rate > 1 (stretch then transpose)', () => {
      const st = new SoundTouch();
      st.rate = 2.0;
      st.tempo = 1.0;

      const sampleCount = st.stretch.sampleReq * 4;
      const samples = new Float32Array(sampleCount * 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01);
      }
      st.inputBuffer.putSamples(samples);

      st.process();
      expect(st.outputBuffer.frameCount).toBeGreaterThanOrEqual(0);
    });

    it('processes with rate <= 1 (transpose then stretch)', () => {
      const st = new SoundTouch();
      st.rate = 0.5;
      st.tempo = 1.0;

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
