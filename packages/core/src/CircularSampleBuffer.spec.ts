import { describe, expect, it } from 'vitest';
import CircularSampleBuffer from './CircularSampleBuffer.js';

describe('CircularSampleBuffer', () => {
  it('starts empty', () => {
    const buffer = new CircularSampleBuffer();
    expect(buffer.frameCount).toBe(0);
    expect(buffer.capacityFrames).toBeGreaterThan(0);
  });

  it('pushes and extracts frames in order', () => {
    const buffer = new CircularSampleBuffer(4);
    buffer.pushSamples(new Float32Array([1, 2, 3, 4, 5, 6]));

    const out = new Float32Array(6);
    const read = buffer.extract(out, 0, 3, true);

    expect(read).toBe(3);
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(buffer.frameCount).toBe(0);
  });

  it('wraps correctly after dropping and writing', () => {
    const buffer = new CircularSampleBuffer(4);
    buffer.pushSamples(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]));
    buffer.dropFrames(3);
    buffer.pushSamples(new Float32Array([9, 10, 11, 12, 13, 14]));

    const out = new Float32Array(8);
    const read = buffer.extract(out, 0, 4, false);

    expect(read).toBe(4);
    expect(Array.from(out)).toEqual([7, 8, 9, 10, 11, 12, 13, 14]);
    expect(buffer.frameCount).toBe(4);
  });

  it('grows capacity while preserving frame order', () => {
    const buffer = new CircularSampleBuffer(2);
    buffer.pushSamples(new Float32Array([1, 2, 3, 4]));
    buffer.pushSamples(new Float32Array([5, 6, 7, 8, 9, 10]));

    expect(buffer.capacityFrames).toBeGreaterThanOrEqual(5);

    const out = new Float32Array(10);
    const read = buffer.extract(out, 0, 5, true);

    expect(read).toBe(5);
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(buffer.frameCount).toBe(0);
  });

  it('supports offset extraction and consume behavior', () => {
    const buffer = new CircularSampleBuffer(8);
    buffer.pushSamples(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]));

    const out = new Float32Array(4);
    const read = buffer.extract(out, 1, 2, true);

    expect(read).toBe(2);
    expect(Array.from(out)).toEqual([3, 4, 5, 6]);
    expect(buffer.frameCount).toBe(1);

    const remainder = new Float32Array(2);
    buffer.extract(remainder, 0, 1, false);
    expect(Array.from(remainder)).toEqual([7, 8]);
  });

  it('normalizes non-integer frame arguments', () => {
    const buffer = new CircularSampleBuffer(2.8);
    buffer.pushSamples(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]), 0.4, 2.9);

    expect(buffer.frameCount).toBe(2);

    const out = new Float32Array(4);
    const read = buffer.extract(out, 0.2, 1.8, true);

    expect(read).toBe(1);
    expect(Array.from(out)).toEqual([1, 2, 0, 0]);
    expect(buffer.frameCount).toBe(1);
  });

  it('reads individual samples across wrapped storage', () => {
    const buffer = new CircularSampleBuffer(4);
    buffer.pushSamples(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]));
    buffer.dropFrames(3);
    buffer.pushSamples(new Float32Array([9, 10, 11, 12, 13, 14]));

    expect(buffer.readSample(0)).toBe(7);
    expect(buffer.readSample(1)).toBe(8);
    expect(buffer.readSample(2)).toBe(9);
    expect(buffer.readSample(7)).toBe(14);
    expect(buffer.readSample(8)).toBe(0);
  });
});
