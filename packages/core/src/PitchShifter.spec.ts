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
  let onaudioprocessHandler: ((event: AudioProcessingEvent) => void) | null =
    null;

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
    _trigger(event: AudioProcessingEvent) {
      onaudioprocessHandler?.(event);
    },
  };

  return {
    createScriptProcessor: vi.fn(() => node),
    sampleRate: 44100,
  } as unknown as BaseAudioContext;
}

function createMockAudioProcessingEvent(
  bufferSize: number,
): AudioProcessingEvent {
  const left = new Float32Array(bufferSize);
  const right = new Float32Array(bufferSize);

  return {
    outputBuffer: {
      getChannelData: vi.fn((channel: number) =>
        channel === 0 ? left : right,
      ),
    },
  } as unknown as AudioProcessingEvent;
}

describe('PitchShifter', () => {
  describe('constructor', () => {
    it('initializes with correct defaults', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
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
      expect(
        () =>
          new PitchShifter({
            context: ctx,
            buffer,
            bufferSize: 4096,
            onEnd,
          }),
      ).not.toThrow();
    });

    it('accepts circular sample buffer type', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      expect(
        () =>
          new PitchShifter({
            context: ctx,
            buffer,
            bufferSize: 4096,
            sampleBufferType: 'circular',
          }),
      ).not.toThrow();
    });

    it('accepts sampleBufferType option', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      expect(
        () =>
          new PitchShifter({
            context: ctx,
            buffer,
            bufferSize: 4096,
            sampleBufferType: 'fifo',
          }),
      ).not.toThrow();
    });

    it('accepts interpolationStrategy option', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      expect(
        () =>
          new PitchShifter({
            context: ctx,
            buffer,
            bufferSize: 4096,
            interpolationStrategy: 'lanczos',
          }),
      ).not.toThrow();
    });
  });

  describe('formattedDuration', () => {
    it('returns formatted MM:SS string', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer(44100 * 65);
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      expect(shifter.formattedDuration).toBe('1:05');
    });
  });

  describe('formattedTimePlayed', () => {
    it('returns 0:00 initially', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      expect(shifter.formattedTimePlayed).toBe('0:00');
    });
  });

  describe('percentagePlayed', () => {
    it('returns 0 initially', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      expect(shifter.percentagePlayed).toBe(0);
    });

    it('can be set and updates internal state', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      shifter.percentagePlayed = 0.5;
      expect(shifter.timePlayed).toBeGreaterThan(0);
      expect(shifter.sourcePosition).toBeGreaterThan(0);
    });
  });

  describe('node', () => {
    it('returns the ScriptProcessorNode', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      expect(shifter.node).toBeDefined();
    });
  });

  describe('pitch / rate / tempo setters', () => {
    it('sets pitch without throwing', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      expect(() => {
        shifter.pitch = 2.0;
      }).not.toThrow();
    });

    it('sets rate without throwing', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      expect(() => {
        shifter.rate = 1.5;
      }).not.toThrow();
    });

    it('sets tempo without throwing', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      expect(() => {
        shifter.tempo = 0.5;
      }).not.toThrow();
    });

    it('sets pitchSemitones without throwing', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      expect(() => {
        shifter.pitchSemitones = 3;
      }).not.toThrow();
    });
  });

  describe('connect / disconnect', () => {
    it('delegates connect to the internal node', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      const destNode = { context: ctx } as unknown as AudioNode;
      shifter.connect(destNode);
      expect(shifter.node.connect).toHaveBeenCalledWith(destNode);
    });

    it('delegates disconnect to the internal node', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      shifter.disconnect();
      expect(shifter.node.disconnect).toHaveBeenCalled();
    });
  });

  describe('on / off', () => {
    it('registers event listener', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      const cb = vi.fn();
      shifter.on('play', cb);
      expect(shifter.listeners).toHaveLength(1);
      expect(shifter.listeners[0].name).toBe('play');
      expect(shifter.node.addEventListener).toHaveBeenCalled();
    });

    it('removes all listeners when off() called without argument', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      shifter.on('play', vi.fn());
      shifter.on('play', vi.fn());
      shifter.off();
      expect(shifter.node.removeEventListener).toHaveBeenCalledTimes(2);
    });

    it('removes only matching listeners when name is provided', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      shifter.on('play', vi.fn());
      shifter.on('other', vi.fn());
      shifter.off('play');
      expect(shifter.node.removeEventListener).toHaveBeenCalledTimes(1);
    });

    it('invokes the registered callback with play event detail', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      const cb = vi.fn();

      shifter.on('play', cb);

      const handler = vi.mocked(shifter.node.addEventListener).mock
        .calls[0]?.[1] as (
        event: CustomEvent<{
          timePlayed: number;
          formattedTimePlayed: string;
          percentagePlayed: number;
        }>,
      ) => void;

      handler(
        new CustomEvent('play', {
          detail: {
            timePlayed: 1,
            formattedTimePlayed: '0:01',
            percentagePlayed: 25,
          },
        }),
      );

      expect(cb).toHaveBeenCalledWith({
        timePlayed: 1,
        formattedTimePlayed: '0:01',
        percentagePlayed: 25,
      });
    });
  });

  describe('audio processing events', () => {
    it('dispatches a play event when source position changes', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer(44100 * 2);
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      const node = shifter.node as unknown as {
        _trigger: (event: AudioProcessingEvent) => void;
      };

      node._trigger(createMockAudioProcessingEvent(4096));

      expect(shifter.node.dispatchEvent).toHaveBeenCalledTimes(1);
    });

    it('does not dispatch a play event when source position does not change', () => {
      const ctx = createMockAudioContext();
      const buffer = createMockAudioBuffer();
      const shifter = new PitchShifter({
        context: ctx,
        buffer,
        bufferSize: 4096,
      });
      const node = shifter.node as unknown as {
        _trigger: (event: AudioProcessingEvent) => void;
      };
      const filter = (
        shifter as unknown as {
          _filter: {
            extract: (target: Float32Array, numFrames: number) => number;
          };
        }
      )._filter;

      vi.spyOn(filter, 'extract').mockReturnValue(0);

      node._trigger(createMockAudioProcessingEvent(4096));

      expect(shifter.node.dispatchEvent).not.toHaveBeenCalled();
    });
  });
});
