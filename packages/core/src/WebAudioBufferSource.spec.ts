import { describe, it, expect, vi } from 'vitest';
import WebAudioBufferSource from './WebAudioBufferSource.js';

function createMockAudioBuffer(
  length = 100,
  channels = 2,
): AudioBuffer {
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      data[i] = (c + 1) * (i + 1) * 0.01;
    }
    channelData.push(data);
  }
  return {
    numberOfChannels: channels,
    length,
    duration: length / 44100,
    sampleRate: 44100,
    getChannelData: vi.fn((channel: number) => channelData[channel]),
  } as unknown as AudioBuffer;
}

describe('WebAudioBufferSource', () => {
  describe('constructor', () => {
    it('initializes with position 0', () => {
      const buffer = createMockAudioBuffer();
      const source = new WebAudioBufferSource(buffer);
      expect(source.position).toBe(0);
      expect(source.buffer).toBe(buffer);
    });
  });

  describe('dualChannel', () => {
    it('returns true for stereo buffers', () => {
      const source = new WebAudioBufferSource(createMockAudioBuffer(100, 2));
      expect(source.dualChannel).toBe(true);
    });

    it('returns false for mono buffers', () => {
      const source = new WebAudioBufferSource(createMockAudioBuffer(100, 1));
      expect(source.dualChannel).toBe(false);
    });
  });

  describe('position', () => {
    it('can be set and read', () => {
      const source = new WebAudioBufferSource(createMockAudioBuffer());
      source.position = 50;
      expect(source.position).toBe(50);
    });
  });

  describe('extract', () => {
    it('interleaves stereo samples into the target', () => {
      const buffer = createMockAudioBuffer(100, 2);
      const source = new WebAudioBufferSource(buffer);
      const target = new Float32Array(10);
      const extracted = source.extract(target, 5, 0);

      expect(extracted).toBe(5);
      expect(source.position).toBe(0);

      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      expect(target[0]).toBe(left[0]);
      expect(target[1]).toBe(right[0]);
      expect(target[2]).toBe(left[1]);
      expect(target[3]).toBe(right[1]);
    });

    it('updates position to the given value', () => {
      const source = new WebAudioBufferSource(createMockAudioBuffer());
      const target = new Float32Array(10);
      source.extract(target, 5, 10);
      expect(source.position).toBe(10);
    });

    it('returns clamped frame count when near end', () => {
      const buffer = createMockAudioBuffer(10, 2);
      const source = new WebAudioBufferSource(buffer);
      const target = new Float32Array(20);
      const extracted = source.extract(target, 10, 5);
      expect(extracted).toBe(5);
    });

    it('uses left channel for both when mono', () => {
      const buffer = createMockAudioBuffer(100, 1);
      const source = new WebAudioBufferSource(buffer);
      const target = new Float32Array(4);
      source.extract(target, 2, 0);

      const left = buffer.getChannelData(0);
      expect(target[0]).toBe(left[0]);
      expect(target[1]).toBe(left[0]);
      expect(target[2]).toBe(left[1]);
      expect(target[3]).toBe(left[1]);
    });
  });
});
