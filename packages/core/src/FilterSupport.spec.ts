import { describe, it, expect, vi } from 'vitest';
import FilterSupport from './FilterSupport.js';
import type { SamplePipe } from './FilterSupport.js';
import FifoSampleBuffer from './FifoSampleBuffer.js';

function createMockPipe(): SamplePipe {
  return {
    inputBuffer: new FifoSampleBuffer(),
    outputBuffer: new FifoSampleBuffer(),
    process: vi.fn(),
    clear: vi.fn(),
  };
}

describe('FilterSupport', () => {
  describe('constructor', () => {
    it('stores the pipe reference', () => {
      const pipe = createMockPipe();
      const filter = new FilterSupport(pipe);
      expect(filter.pipe).toBe(pipe);
    });
  });

  describe('inputBuffer / outputBuffer', () => {
    it('delegates to the pipe', () => {
      const pipe = createMockPipe();
      const filter = new FilterSupport(pipe);
      expect(filter.inputBuffer).toBe(pipe.inputBuffer);
      expect(filter.outputBuffer).toBe(pipe.outputBuffer);
    });
  });

  describe('fillInputBuffer', () => {
    it('throws if not overridden', () => {
      const pipe = createMockPipe();
      const filter = new FilterSupport(pipe);
      expect(() => filter.fillInputBuffer(100)).toThrow(
        'fillInputBuffer() not overridden',
      );
    });
  });

  describe('clear', () => {
    it('delegates to pipe.clear()', () => {
      const pipe = createMockPipe();
      const filter = new FilterSupport(pipe);
      filter.clear();
      expect(pipe.clear).toHaveBeenCalled();
    });
  });

  describe('fillOutputBuffer', () => {
    it('calls fillInputBuffer and pipe.process in a loop', () => {
      const pipe = createMockPipe();

      let callCount = 0;
      pipe.process = vi.fn(() => {
        pipe.outputBuffer!.putSamples(new Float32Array(200));
      });

      const filter = new FilterSupport(pipe);
      filter.fillInputBuffer = vi.fn((_numFrames: number) => {
        callCount++;
        const samples = new Float32Array(8192 * 2 * 2);
        pipe.inputBuffer!.putSamples(samples);
      });

      filter.fillOutputBuffer(50);

      expect(filter.fillInputBuffer).toHaveBeenCalled();
      expect(pipe.process).toHaveBeenCalled();
      expect(callCount).toBeGreaterThanOrEqual(1);
    });
  });
});
