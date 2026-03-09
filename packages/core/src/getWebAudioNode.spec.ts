import { describe, it, expect, vi } from 'vitest';
import getWebAudioNode from './getWebAudioNode.js';
import SimpleFilter from './SimpleFilter.js';
import SoundTouch from './SoundTouch.js';

function createMockSource(length = 100000) {
  return {
    extract: vi.fn(
      (target: Float32Array, numFrames: number, _position: number) => {
        for (let i = 0; i < numFrames * 2; i++) {
          target[i] = Math.sin(i * 0.01);
        }
        return Math.min(numFrames, length - _position);
      },
    ),
  };
}

function createMockAudioContext(bufferSize = 4096): BaseAudioContext {
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

describe('getWebAudioNode', () => {
  it('creates a ScriptProcessorNode', () => {
    const ctx = createMockAudioContext();
    const source = createMockSource();
    const pipe = new SoundTouch();
    const filter = new SimpleFilter(source, pipe);

    const node = getWebAudioNode(ctx, filter);
    expect(ctx.createScriptProcessor).toHaveBeenCalledWith(4096, 2, 2);
    expect(node).toBeDefined();
  });

  it('accepts a custom buffer size', () => {
    const ctx = createMockAudioContext(8192);
    const source = createMockSource();
    const pipe = new SoundTouch();
    const filter = new SimpleFilter(source, pipe);

    getWebAudioNode(ctx, filter, undefined, 8192);
    expect(ctx.createScriptProcessor).toHaveBeenCalledWith(8192, 2, 2);
  });

  it('calls sourcePositionCallback during audio processing', () => {
    const ctx = createMockAudioContext();
    const source = createMockSource();
    const pipe = new SoundTouch();
    const filter = new SimpleFilter(source, pipe);
    const posCallback = vi.fn();

    const node = getWebAudioNode(ctx, filter, posCallback) as unknown as {
      _trigger: (event: AudioProcessingEvent) => void;
    };

    const event = createMockAudioProcessingEvent(4096);
    node._trigger(event as AudioProcessingEvent);

    expect(posCallback).toHaveBeenCalled();
  });

  it('calls filter.onEnd when no frames are extracted', () => {
    const ctx = createMockAudioContext();
    const source = createMockSource();
    const pipe = new SoundTouch();
    const filter = new SimpleFilter(source, pipe);
    vi.spyOn(filter, 'extract').mockReturnValue(0);
    const onEndSpy = vi.spyOn(filter, 'onEnd');

    const node = getWebAudioNode(ctx, filter) as unknown as {
      _trigger: (event: AudioProcessingEvent) => void;
    };

    const event = createMockAudioProcessingEvent(4096);
    node._trigger(event as AudioProcessingEvent);

    expect(onEndSpy).toHaveBeenCalled();
  });
});
