import { describe, expect, it } from 'vitest';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import type { SampleBuffer } from './SampleBuffer.js';
import {
  createCircularSampleBufferAdapter,
  createFifoSampleBufferAdapter,
} from './SampleBufferAdapter.js';

class TestSampleBuffer implements SampleBuffer {
  private readonly data: Float32Array;
  private consumedFrames: number;

  constructor(data: Float32Array) {
    this.data = data;
    this.consumedFrames = 0;
  }

  get frameCount(): number {
    return Math.max(0, this.data.length / 2 - this.consumedFrames);
  }

  clear(): void {
    this.consumedFrames = this.data.length / 2;
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
    const startFrame = this.consumedFrames + position;
    const start = startFrame * 2;
    const end = start + framesToCopy * 2;
    output.set(this.data.subarray(start, end), 0);
  }

  receive(numFrames = this.frameCount): void {
    this.consumedFrames = Math.min(
      this.consumedFrames + numFrames,
      this.data.length / 2,
    );
  }
}

describe('SampleBufferAdapter', () => {
  describe('fifo-backed adapter', () => {
    it('returns zero when no input buffer has been bound', () => {
      const adapter = createFifoSampleBufferAdapter();
      const out = new Float32Array(4);

      expect(adapter.extract(out, 0, 2)).toBe(0);
    });

    it('reads and consumes samples from fifo input buffer', () => {
      const input = new FifoSampleBuffer();
      input.putSamples(new Float32Array([1, 2, 3, 4, 5, 6]));

      const adapter = createFifoSampleBufferAdapter();
      adapter.syncFromInputBuffer(input);

      expect(adapter.frameCount).toBe(3);

      const out = new Float32Array(4);
      const extracted = adapter.extract(out, 1, 2);

      expect(extracted).toBe(2);
      expect(Array.from(out)).toEqual([3, 4, 5, 6]);

      adapter.receive(2);
      expect(input.frameCount).toBe(1);
    });

    it('bridges non-fifo input via shared sample buffer contract', () => {
      const input = new TestSampleBuffer(new Float32Array([1, 2, 3, 4, 5, 6]));

      const adapter = createFifoSampleBufferAdapter();
      adapter.syncFromInputBuffer(input);

      expect(input.frameCount).toBe(3);
      expect(adapter.frameCount).toBe(3);

      const out = new Float32Array(6);
      const extracted = adapter.extract(out, 0, 3);
      expect(extracted).toBe(3);
      expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6]);

      adapter.receive(3);
      expect(input.frameCount).toBe(0);
    });

    it('returns zero when the requested range is outside the available frames', () => {
      const input = new FifoSampleBuffer();
      input.putSamples(new Float32Array([1, 2, 3, 4]));

      const adapter = createFifoSampleBufferAdapter();
      adapter.syncFromInputBuffer(input);

      expect(adapter.extract(new Float32Array(4), 10, 2)).toBe(0);
    });
  });

  describe('circular-backed adapter', () => {
    it('ignores empty fifo input buffers', () => {
      const input = new FifoSampleBuffer();
      const adapter = createCircularSampleBufferAdapter();

      adapter.syncFromInputBuffer(input);

      expect(adapter.frameCount).toBe(0);
    });

    it('copies from fifo input and then serves from circular storage', () => {
      const input = new FifoSampleBuffer();
      input.putSamples(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]));

      const adapter = createCircularSampleBufferAdapter();
      adapter.syncFromInputBuffer(input);

      expect(input.frameCount).toBe(0);
      expect(adapter.frameCount).toBe(4);

      const out = new Float32Array(4);
      const extracted = adapter.extract(out, 1, 2);
      expect(extracted).toBe(2);
      expect(Array.from(out)).toEqual([3, 4, 5, 6]);

      adapter.receive(3);
      expect(adapter.frameCount).toBe(1);
    });

    it('consumes non-fifo input through shared sample buffer contract', () => {
      const input = new TestSampleBuffer(new Float32Array([1, 2, 3, 4, 5, 6]));

      const adapter = createCircularSampleBufferAdapter();
      adapter.syncFromInputBuffer(input);

      expect(input.frameCount).toBe(0);
      expect(adapter.frameCount).toBe(3);

      const out = new Float32Array(6);
      const extracted = adapter.extract(out, 0, 3);
      expect(extracted).toBe(3);
      expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('clears buffered frames when reset', () => {
      const input = new FifoSampleBuffer();
      input.putSamples(new Float32Array([1, 2, 3, 4]));

      const adapter = createCircularSampleBufferAdapter();
      adapter.syncFromInputBuffer(input);
      adapter.clear();

      expect(adapter.frameCount).toBe(0);
    });
  });
});
