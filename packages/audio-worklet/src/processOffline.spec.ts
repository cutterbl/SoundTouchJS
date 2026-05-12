import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Minimal stubs ──────────────────────────────────────────────────────────

const addModule = vi.fn().mockResolvedValue(undefined);

const mockPitchParam = { value: 1.0 };
const mockSemitonesParam = { value: 0 };
const mockPlaybackRateParam = { value: 1.0 };
const mockSetStretchParameters = vi.fn();
const mockConnect = vi.fn();

const mockSourcePlaybackRate = { value: 1.0 };
const mockSourceConnect = vi.fn();
const mockSourceStart = vi.fn();

const mockCreateBufferSource = vi.fn(() => ({
  playbackRate: mockSourcePlaybackRate,
  buffer: null as AudioBuffer | null,
  connect: mockSourceConnect,
  start: mockSourceStart,
}));

const mockRenderedBuffer = {} as AudioBuffer;
const mockStartRendering = vi.fn().mockResolvedValue(mockRenderedBuffer);

const mockDestination = {} as AudioDestinationNode;

class MockOfflineAudioContext {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  audioWorklet = { addModule };
  destination = mockDestination;
  startRendering = mockStartRendering;
  createBufferSource = mockCreateBufferSource;

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
  }
}

class MockAudioWorkletNode {
  parameters: Map<string, unknown>;
  port = { postMessage: vi.fn() };
  connect = mockConnect;

  constructor() {
    this.parameters = new Map([
      ['pitch', mockPitchParam],
      ['pitchSemitones', mockSemitonesParam],
      ['playbackRate', mockPlaybackRateParam],
    ]);
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  addModule.mockClear();
  mockSetStretchParameters.mockClear();
  mockConnect.mockClear();
  mockSourceConnect.mockClear();
  mockSourceStart.mockClear();
  mockStartRendering.mockResolvedValue(mockRenderedBuffer);
  mockPitchParam.value = 1.0;
  mockSemitonesParam.value = 0;
  mockPlaybackRateParam.value = 1.0;
  mockSourcePlaybackRate.value = 1.0;

  vi.stubGlobal('OfflineAudioContext', MockOfflineAudioContext);
  vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);
});

describe('processOffline', () => {
  function makeInput(length = 4410, channels = 2, sampleRate = 44100): AudioBuffer {
    return { length, numberOfChannels: channels, sampleRate } as AudioBuffer;
  }

  it('registers the processor and returns the rendered buffer', async () => {
    const { processOffline } = await import('./processOffline.js');
    const input = makeInput();
    const result = await processOffline({
      input,
      processorUrl: '/proc.js',
    });

    expect(addModule).toHaveBeenCalledWith('/proc.js');
    expect(mockStartRendering).toHaveBeenCalled();
    expect(result).toBe(mockRenderedBuffer);
  });

  it('scales output length by 1/playbackRate', async () => {
    const { processOffline } = await import('./processOffline.js');
    const input = makeInput(44100);
    let capturedLength = 0;
    vi.stubGlobal(
      'OfflineAudioContext',
      class extends MockOfflineAudioContext {
        constructor(ch: number, len: number, sr: number) {
          super(ch, len, sr);
          capturedLength = len;
        }
      },
    );

    await processOffline({ input, processorUrl: '/proc.js', playbackRate: 2.0 });
    expect(capturedLength).toBe(Math.ceil(44100 / 2.0));
  });

  it('sets pitch, pitchSemitones, and playbackRate AudioParams', async () => {
    const { processOffline } = await import('./processOffline.js');
    const input = makeInput();
    await processOffline({
      input,
      processorUrl: '/proc.js',
      pitch: 1.2,
      pitchSemitones: -3,
      playbackRate: 1.5,
    });

    expect(mockPitchParam.value).toBe(1.2);
    expect(mockSemitonesParam.value).toBe(-3);
    expect(mockPlaybackRateParam.value).toBe(1.5);
    expect(mockSourcePlaybackRate.value).toBe(1.5);
  });

  it('calls setStretchParameters when stretchParameters is provided', async () => {
    // Patch SoundTouchNode to track setStretchParameters calls
    vi.stubGlobal('AudioWorkletNode', class extends MockAudioWorkletNode {});
    const mod = await import('./SoundTouchNode.js');
    const spy = vi
      .spyOn(mod.SoundTouchNode.prototype as unknown as { setStretchParameters: (p: unknown) => void }, 'setStretchParameters')
      .mockImplementation(() => {});

    const { processOffline } = await import('./processOffline.js');
    const input = makeInput();
    await processOffline({
      input,
      processorUrl: '/proc.js',
      stretchParameters: { overlapMs: 12 },
    });

    expect(spy).toHaveBeenCalledWith({ overlapMs: 12 });
    spy.mockRestore();
  });

  it('skips setStretchParameters when not provided', async () => {
    const mod = await import('./SoundTouchNode.js');
    const spy = vi
      .spyOn(mod.SoundTouchNode.prototype as unknown as { setStretchParameters: (p: unknown) => void }, 'setStretchParameters')
      .mockImplementation(() => {});

    const { processOffline } = await import('./processOffline.js');
    await processOffline({ input: makeInput(), processorUrl: '/proc.js' });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('connects the graph: source → stNode → destination', async () => {
    const connectCalls: unknown[] = [];
    vi.stubGlobal(
      'AudioWorkletNode',
      class extends MockAudioWorkletNode {
        connect(dest: unknown) {
          connectCalls.push({ from: 'stNode', to: dest });
        }
      },
    );
    mockSourceConnect.mockImplementation((dest: unknown) => {
      connectCalls.push({ from: 'source', to: dest });
    });

    const { processOffline } = await import('./processOffline.js');
    await processOffline({ input: makeInput(), processorUrl: '/proc.js' });

    expect(connectCalls.some((c) => (c as { from: string }).from === 'source')).toBe(true);
    expect(mockSourceStart).toHaveBeenCalledWith(0);
  });
});
