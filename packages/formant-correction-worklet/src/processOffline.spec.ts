import { beforeEach, describe, expect, it, vi } from 'vitest';

const addModule = vi.fn().mockResolvedValue(undefined);

const mockPitchParam = { value: 1.0 };
const mockSemitonesParam = { value: 0 };
const mockPlaybackRateParam = { value: 1.0 };
const mockFormantStrengthParam = { value: 1.0 };

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
  connect = vi.fn();

  constructor() {
    this.parameters = new Map([
      ['pitch', mockPitchParam],
      ['pitchSemitones', mockSemitonesParam],
      ['playbackRate', mockPlaybackRateParam],
      ['formantStrength', mockFormantStrengthParam],
    ]);
  }
}

beforeEach(() => {
  vi.resetModules();
  addModule.mockClear();
  mockCreateBufferSource.mockClear();
  mockSourceConnect.mockClear();
  mockSourceStart.mockClear();
  mockStartRendering.mockResolvedValue(mockRenderedBuffer);

  mockPitchParam.value = 1.0;
  mockSemitonesParam.value = 0;
  mockPlaybackRateParam.value = 1.0;
  mockFormantStrengthParam.value = 1.0;
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

    const result = await processOffline({
      input: makeInput(),
      processorUrl: '/formant-correction-processor.js',
    });

    expect(addModule).toHaveBeenCalledWith('/formant-correction-processor.js');
    expect(mockStartRendering).toHaveBeenCalled();
    expect(result).toBe(mockRenderedBuffer);
  });

  it('scales output length by 1/playbackRate', async () => {
    const { processOffline } = await import('./processOffline.js');
    let capturedLength = 0;
    vi.stubGlobal(
      'OfflineAudioContext',
      class extends MockOfflineAudioContext {
        constructor(channels: number, length: number, sampleRate: number) {
          super(channels, length, sampleRate);
          capturedLength = length;
        }
      },
    );

    await processOffline({
      input: makeInput(44100),
      processorUrl: '/formant-correction-processor.js',
      playbackRate: 2,
    });

    expect(capturedLength).toBe(Math.ceil(44100 / 2));
  });

  it('sets pitch, semitones, playbackRate, and formantStrength params', async () => {
    const { processOffline } = await import('./processOffline.js');

    await processOffline({
      input: makeInput(),
      processorUrl: '/formant-correction-processor.js',
      pitch: 1.25,
      pitchSemitones: -4,
      playbackRate: 1.5,
      formantStrength: 0.35,
    });

    expect(mockPitchParam.value).toBe(1.25);
    expect(mockSemitonesParam.value).toBe(-4);
    expect(mockPlaybackRateParam.value).toBe(1.5);
    expect(mockFormantStrengthParam.value).toBe(0.35);
    expect(mockSourcePlaybackRate.value).toBe(1.5);
  });

  it('applies stretch parameters when provided', async () => {
    const setStretchSpy = vi
      .spyOn(
        (await import('./FormantCorrectionNode.js')).FormantCorrectionNode.prototype,
        'setStretchParameters',
      )
      .mockImplementation(() => {});

    const { processOffline } = await import('./processOffline.js');
    await processOffline({
      input: makeInput(),
      processorUrl: '/formant-correction-processor.js',
      stretchParameters: { overlapMs: 12 },
    });

    expect(setStretchSpy).toHaveBeenCalledWith({ overlapMs: 12 });
    setStretchSpy.mockRestore();
  });
});
