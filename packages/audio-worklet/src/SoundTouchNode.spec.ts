import { beforeEach, describe, expect, it, vi } from 'vitest';

class MockAudioWorkletNode {
  parameters: Map<string, unknown>;
  port: { postMessage: ReturnType<typeof vi.fn> };

  constructor(_context: BaseAudioContext, _name: string, _options: unknown) {
    this.parameters = new Map();
    this.port = { postMessage: vi.fn() };
  }
}

describe('SoundTouchNode', () => {
  beforeEach(() => {
    vi.resetModules();
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
      interpolationStrategy: 'lanczos8',
    });

    const pitchParam = { value: 1.0 };
    const tempoParam = { value: 1.0 };
    const rateParam = { value: 1.0 };
    const semitonesParam = { value: 0 };
    const playbackRateParam = { value: 1.0 };

    (node as unknown as { parameters: Map<string, unknown> }).parameters =
      new Map([
        ['pitch', pitchParam],
        ['tempo', tempoParam],
        ['rate', rateParam],
        ['pitchSemitones', semitonesParam],
        ['playbackRate', playbackRateParam],
      ]);

    expect(node.pitch).toBe(pitchParam);
    expect(node.tempo).toBe(tempoParam);
    expect(node.rate).toBe(rateParam);
    expect(node.pitchSemitones).toBe(semitonesParam);
    expect(node.playbackRate).toBe(playbackRateParam);
  });

  it('sends runtime strategy control messages via MessagePort', async () => {
    const { SoundTouchNode } = await import('./index.js');
    const context = {} as BaseAudioContext;
    const node = new SoundTouchNode({ context });

    node.setInterpolationStrategy('lanczos8');
    node.setInterpolationStrategyParams({ radius: 6 });

    const port = (
      node as unknown as { port: { postMessage: ReturnType<typeof vi.fn> } }
    ).port;
    expect(port.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'set-interpolation-strategy',
      strategy: 'lanczos8',
    });
    expect(port.postMessage).toHaveBeenNthCalledWith(2, {
      type: 'set-interpolation-strategy-params',
      params: { radius: 6 },
    });
  });
});
