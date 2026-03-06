import { describe, it, expect, vi } from 'vitest';
import PitchShifter from './PitchShifter.js';

function createMockAudioBuffer(length = 44100, channels = 2): AudioBuffer {
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin(i * 0.01 * (c + 1));
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

function createMockAudioContext(): BaseAudioContext {
  let onaudioprocessHandler:
    | ((event: AudioProcessingEvent) => void)
    | null = null;

  const node = {
    set onaudioprocess(fn: (event: AudioProcessingEvent) => void) {
      onaudioprocessHandler = fn;
    },
    get onaudioprocess() {
      return onaudioprocessHandler;
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  return {
    createScriptProcessor: vi.fn(() => node),
    sampleRate: 44100,
  } as unknown as BaseAudioContext;
}

describe('PitchShifter', () => {
  describe('constructor', () => {
    it('initializes with correct defaults', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      expect(shifter.timePlayed).toBe(0);
      expect(shifter.sourcePosition).toBe(0);
      expect(shifter.duration).toBe(buffer.duration);
      expect(shifter.sampleRate).toBe(44100);
      expect(shifter.listeners).toEqual([]);
    });

    it('accepts an onEnd callback', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const onEnd = vi.fn();
      expect(() => new PitchShifter(ctx, buffer, 4096, onEnd)).not.toThrow();
    });
  });

  describe('formattedDuration', () => {
    it('returns formatted MM:SS string', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer(44100 * 65);
      const shifter = new PitchShifter(ctx, buffer, 4096);
      expect(shifter.formattedDuration).toBe('1:05');
    });
  });

  describe('formattedTimePlayed', () => {
    it('returns 0:00 initially', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      expect(shifter.formattedTimePlayed).toBe('0:00');
    });
  });

  describe('percentagePlayed', () => {
    it('returns 0 initially', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      expect(shifter.percentagePlayed).toBe(0);
    });

    it('can be set and updates internal state', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      shifter.percentagePlayed = 0.5;
      expect(shifter.timePlayed).toBeGreaterThan(0);
      expect(shifter.sourcePosition).toBeGreaterThan(0);
    });
  });

  describe('node', () => {
    it('returns the ScriptProcessorNode', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      expect(shifter.node).toBeDefined();
    });
  });

  describe('pitch / rate / tempo setters', () => {
    it('sets pitch without throwing', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      expect(() => {
        shifter.pitch = 2.0;
      }).not.toThrow();
    });

    it('sets rate without throwing', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      expect(() => {
        shifter.rate = 1.5;
      }).not.toThrow();
    });

    it('sets tempo without throwing', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      expect(() => {
        shifter.tempo = 0.5;
      }).not.toThrow();
    });

    it('sets pitchSemitones without throwing', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      expect(() => {
        shifter.pitchSemitones = 3;
      }).not.toThrow();
    });
  });

  describe('connect / disconnect', () => {
    it('delegates connect to the internal node', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      const destNode = { context: ctx } as unknown as AudioNode;
      shifter.connect(destNode);
      expect(shifter.node.connect).toHaveBeenCalledWith(destNode);
    });

    it('delegates disconnect to the internal node', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      shifter.disconnect();
      expect(shifter.node.disconnect).toHaveBeenCalled();
    });
  });

  describe('on / off', () => {
    it('registers event listener', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      const cb = vi.fn();
      shifter.on('play', cb);
      expect(shifter.listeners).toHaveLength(1);
      expect(shifter.listeners[0].name).toBe('play');
      expect(shifter.node.addEventListener).toHaveBeenCalled();
    });

    it('removes all listeners when off() called without argument', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      shifter.on('play', vi.fn());
      shifter.on('play', vi.fn());
      shifter.off();
      expect(shifter.node.removeEventListener).toHaveBeenCalledTimes(2);
    });

    it('removes only matching listeners when name is provided', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter(ctx, buffer, 4096);
      shifter.on('play', vi.fn());
      shifter.on('other', vi.fn());
      shifter.off('play');
      expect(shifter.node.removeEventListener).toHaveBeenCalledTimes(1);
    });
  });
});
