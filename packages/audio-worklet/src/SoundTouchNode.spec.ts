import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockNodeOptions {
  outputChannelCount?: number[];
  processorOptions?: unknown;
  [key: string]: unknown;
}

const lastCtorOptions: { value: MockNodeOptions | undefined } = {
  value: undefined,
};

class MockAudioWorkletNode {
  parameters: Map<string, unknown>;
  port: { postMessage: ReturnType<typeof vi.fn> };

  constructor(
    _context: BaseAudioContext,
    _name: string,
    options: MockNodeOptions,
  ) {
    lastCtorOptions.value = options;
    this.parameters = new Map();
    this.port = { postMessage: vi.fn() };
  }
}

describe('SoundTouchNode', () => {
  beforeEach(() => {
    vi.resetModules();
    lastCtorOptions.value = undefined;
    vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);
  });

  it('matches the shared processor constant', async () => {
    const { SoundTouchNode, PROCESSOR_NAME } = await import('./index.js');
    expect(SoundTouchNode.processorName).toBe(PROCESSOR_NAME);
  });

  it('calls audioWorklet.addModule with the given URL', async () => {
    const { SoundTouchNode } = await import('./index.js');
    const addModule = vi.fn().mockResolvedValue(undefined);
    const context = {
      audioWorklet: { addModule },
    } as unknown as BaseAudioContext;

    await SoundTouchNode.register(context, '/path/to/processor.js');
    expect(addModule).toHaveBeenCalledWith('/path/to/processor.js');
  });

  it('registers strategy installer modules in worklet scope', async () => {
    const { SoundTouchNode } = await import('./index.js');
    const addModule = vi.fn().mockResolvedValue(undefined);
    const context = {
      audioWorklet: { addModule },
    } as unknown as BaseAudioContext;

    await SoundTouchNode.registerStrategyModule(
      context,
      '/path/to/strategy.worklet.js',
    );

    expect(addModule).toHaveBeenCalledWith('/path/to/strategy.worklet.js');
  });

  it('accepts constructor options and exposes parameter accessors', async () => {
    const { SoundTouchNode } = await import('./index.js');
    const context = {} as BaseAudioContext;
    const node = new SoundTouchNode({
      context,
      sampleBufferType: 'fifo',
      interpolationStrategy: 'lanczos',
    });

    const pitchParam = { value: 1.0 };
    const semitonesParam = { value: 0 };
    const playbackRateParam = { value: 1.0 };

    (node as unknown as { parameters: Map<string, unknown> }).parameters =
      new Map([
        ['pitch', pitchParam],
        ['pitchSemitones', semitonesParam],
        ['playbackRate', playbackRateParam],
      ]);

    expect(node.pitch).toBe(pitchParam);
    expect(node.pitchSemitones).toBe(semitonesParam);
    expect(node.playbackRate).toBe(playbackRateParam);
  });

  it('sends runtime strategy control messages via MessagePort', async () => {
    const { SoundTouchNode } = await import('./index.js');
    const context = {} as BaseAudioContext;
    const node = new SoundTouchNode({ context });

    node.setInterpolationStrategy('lanczos');
    node.setInterpolationStrategyParams({ zeroCrossings: 6 });

    const port = (
      node as unknown as { port: { postMessage: ReturnType<typeof vi.fn> } }
    ).port;
    expect(port.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'set-interpolation-strategy',
      strategy: 'lanczos',
    });
    expect(port.postMessage).toHaveBeenNthCalledWith(2, {
      type: 'set-interpolation-strategy-params',
      params: { zeroCrossings: 6 },
    });
  });

  it('sends set-stretch-parameters message via MessagePort', async () => {
    const { SoundTouchNode } = await import('./index.js');
    const context = {} as BaseAudioContext;
    const node = new SoundTouchNode({ context });

    node.setStretchParameters({ overlapMs: 12, quickSeek: false });

    const port = (
      node as unknown as { port: { postMessage: ReturnType<typeof vi.fn> } }
    ).port;
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'set-stretch-parameters',
      params: { overlapMs: 12, quickSeek: false },
    });
  });

  describe('outputChannelCount option', () => {
    it('defaults to stereo (outputChannelCount [2]) when not specified', async () => {
      const { SoundTouchNode } = await import('./index.js');
      new SoundTouchNode({ context: {} as BaseAudioContext });
      expect(lastCtorOptions.value?.outputChannelCount).toEqual([2]);
    });

    it('passes [1] when outputChannelCount is 1', async () => {
      const { SoundTouchNode } = await import('./index.js');
      new SoundTouchNode({
        context: {} as BaseAudioContext,
        outputChannelCount: 1,
      });
      expect(lastCtorOptions.value?.outputChannelCount).toEqual([1]);
    });

    it('passes [2] when outputChannelCount is 2', async () => {
      const { SoundTouchNode } = await import('./index.js');
      new SoundTouchNode({
        context: {} as BaseAudioContext,
        outputChannelCount: 2,
      });
      expect(lastCtorOptions.value?.outputChannelCount).toEqual([2]);
    });
  });
});
