import { describe, it, expect } from 'vitest';
import FifoSampleBuffer from './FifoSampleBuffer.js';

describe('FifoSampleBuffer', () => {
  describe('constructor', () => {
    it('starts empty', () => {
      const buf = new FifoSampleBuffer();
      expect(buf.frameCount).toBe(0);
      expect(buf.position).toBe(0);
      expect(buf.startIndex).toBe(0);
      expect(buf.endIndex).toBe(0);
    });
  });

  describe('putSamples / frameCount', () => {
    it('accepts interleaved stereo samples', () => {
      const buf = new FifoSampleBuffer();
      const samples = new Float32Array([1, 2, 3, 4, 5, 6]);
      buf.putSamples(samples);
      expect(buf.frameCount).toBe(3);
    });

    it('accepts samples with a position offset', () => {
      const buf = new FifoSampleBuffer();
      const samples = new Float32Array([1, 2, 3, 4, 5, 6]);
      buf.putSamples(samples, 1, 2);
      expect(buf.frameCount).toBe(2);
    });

    it('accumulates frames across multiple puts', () => {
      const buf = new FifoSampleBuffer();
      buf.putSamples(new Float32Array([1, 2, 3, 4]));
      buf.putSamples(new Float32Array([5, 6, 7, 8]));
      expect(buf.frameCount).toBe(4);
    });
  });

  describe('receiveSamples', () => {
    it('reads samples and advances position', () => {
      const buf = new FifoSampleBuffer();
      buf.putSamples(new Float32Array([1, 2, 3, 4, 5, 6]));
      const output = new Float32Array(4);
      buf.receiveSamples(output, 2);
      expect(output[0]).toBe(1);
      expect(output[1]).toBe(2);
      expect(output[2]).toBe(3);
      expect(output[3]).toBe(4);
      expect(buf.frameCount).toBe(1);
    });
  });

  describe('receive', () => {
    it('discards frames from the front', () => {
      const buf = new FifoSampleBuffer();
      buf.putSamples(new Float32Array([1, 2, 3, 4, 5, 6]));
      buf.receive(1);
      expect(buf.frameCount).toBe(2);
      expect(buf.position).toBe(1);
    });

    it('receives all frames when called without argument', () => {
      const buf = new FifoSampleBuffer();
      buf.putSamples(new Float32Array([1, 2, 3, 4]));
      buf.receive();
      expect(buf.frameCount).toBe(0);
    });
  });

  describe('extract', () => {
    it('reads samples without consuming them', () => {
      const buf = new FifoSampleBuffer();
      buf.putSamples(new Float32Array([10, 20, 30, 40, 50, 60]));
      const output = new Float32Array(4);
      buf.extract(output, 0, 2);
      expect(output[0]).toBe(10);
      expect(output[1]).toBe(20);
      expect(output[2]).toBe(30);
      expect(output[3]).toBe(40);
      expect(buf.frameCount).toBe(3);
    });

    it('extracts from a position offset', () => {
      const buf = new FifoSampleBuffer();
      buf.putSamples(new Float32Array([10, 20, 30, 40, 50, 60]));
      const output = new Float32Array(2);
      buf.extract(output, 1, 1);
      expect(output[0]).toBe(30);
      expect(output[1]).toBe(40);
    });
  });

  describe('clear', () => {
    it('resets the buffer to empty', () => {
      const buf = new FifoSampleBuffer();
      buf.putSamples(new Float32Array([1, 2, 3, 4]));
      buf.clear();
      expect(buf.frameCount).toBe(0);
      expect(buf.position).toBe(0);
    });
  });

  describe('putBuffer', () => {
    it('copies frames from another buffer', () => {
      const src = new FifoSampleBuffer();
      src.putSamples(new Float32Array([1, 2, 3, 4, 5, 6]));

      const dest = new FifoSampleBuffer();
      dest.putBuffer(src);
      expect(dest.frameCount).toBe(3);

      const output = new Float32Array(6);
      dest.receiveSamples(output, 3);
      expect(output[0]).toBe(1);
      expect(output[5]).toBe(6);
    });

    it('copies a subset of frames from another buffer', () => {
      const src = new FifoSampleBuffer();
      src.putSamples(new Float32Array([1, 2, 3, 4, 5, 6]));

      const dest = new FifoSampleBuffer();
      dest.putBuffer(src, 1, 1);
      expect(dest.frameCount).toBe(1);

      const output = new Float32Array(2);
      dest.receiveSamples(output, 1);
      expect(output[0]).toBe(3);
      expect(output[1]).toBe(4);
    });
  });

  describe('ensureCapacity', () => {
    it('grows the internal vector when needed', () => {
      const buf = new FifoSampleBuffer();
      buf.ensureCapacity(100);
      expect(buf.vector.length).toBeGreaterThanOrEqual(200);
    });

    it('rewinds when capacity is sufficient', () => {
      const buf = new FifoSampleBuffer();
      buf.putSamples(new Float32Array(200));
      buf.receive(50);
      expect(buf.position).toBe(50);
      buf.ensureCapacity(buf.frameCount);
      expect(buf.position).toBe(0);
    });
  });

  describe('put', () => {
    it('increments frame count without adding sample data', () => {
      const buf = new FifoSampleBuffer();
      buf.ensureCapacity(10);
      buf.put(5);
      expect(buf.frameCount).toBe(5);
    });
  });

  describe('startIndex / endIndex', () => {
    it('computes correct sample indices', () => {
      const buf = new FifoSampleBuffer();
      buf.putSamples(new Float32Array([1, 2, 3, 4, 5, 6]));
      expect(buf.startIndex).toBe(0);
      expect(buf.endIndex).toBe(6);
      buf.receive(1);
      expect(buf.startIndex).toBe(2);
      expect(buf.endIndex).toBe(6);
    });
  });
});
