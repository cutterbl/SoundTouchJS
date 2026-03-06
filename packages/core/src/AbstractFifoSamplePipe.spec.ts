import { describe, it, expect } from 'vitest';
import AbstractFifoSamplePipe from './AbstractFifoSamplePipe.js';
import FifoSampleBuffer from './FifoSampleBuffer.js';

describe('AbstractFifoSamplePipe', () => {
  describe('constructor with createBuffers=true', () => {
    it('creates input and output buffers', () => {
      const pipe = new AbstractFifoSamplePipe(true);
      expect(pipe.inputBuffer).toBeInstanceOf(FifoSampleBuffer);
      expect(pipe.outputBuffer).toBeInstanceOf(FifoSampleBuffer);
    });
  });

  describe('constructor with createBuffers=false', () => {
    it('sets buffers to null', () => {
      const pipe = new AbstractFifoSamplePipe(false);
      expect(pipe.inputBuffer).toBeNull();
      expect(pipe.outputBuffer).toBeNull();
    });
  });

  describe('constructor with no argument', () => {
    it('sets buffers to null', () => {
      const pipe = new AbstractFifoSamplePipe();
      expect(pipe.inputBuffer).toBeNull();
      expect(pipe.outputBuffer).toBeNull();
    });
  });

  describe('buffer setters', () => {
    it('allows setting input and output buffers', () => {
      const pipe = new AbstractFifoSamplePipe();
      const input = new FifoSampleBuffer();
      const output = new FifoSampleBuffer();
      pipe.inputBuffer = input;
      pipe.outputBuffer = output;
      expect(pipe.inputBuffer).toBe(input);
      expect(pipe.outputBuffer).toBe(output);
    });
  });

  describe('clear', () => {
    it('clears both buffers', () => {
      const pipe = new AbstractFifoSamplePipe(true);
      pipe.inputBuffer!.putSamples(new Float32Array([1, 2, 3, 4]));
      pipe.outputBuffer!.putSamples(new Float32Array([5, 6, 7, 8]));
      pipe.clear();
      expect(pipe.inputBuffer!.frameCount).toBe(0);
      expect(pipe.outputBuffer!.frameCount).toBe(0);
    });

    it('does not throw when buffers are null', () => {
      const pipe = new AbstractFifoSamplePipe(false);
      expect(() => pipe.clear()).not.toThrow();
    });
  });
});
