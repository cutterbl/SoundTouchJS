import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockNodeOptions {
  outputChannelCount?: number[];
  processorOptions?: unknown;
  [key: string]: unknown;
}

const lastCtorOptions: { value: MockNodeOptions | undefined } = {
  value: undefined,
};

type MessageListener = (event: MessageEvent) => void;

class MockAudioWorkletNode {
  parameters: Map<string, unknown>;
  port: {
    postMessage: ReturnType<typeof vi.fn>;
    onmessage: MessageListener | null;
  };
  private _listeners: Map<string, EventListenerOrEventListenerObject[]> =
    new Map();

  constructor(
    _context: BaseAudioContext,
    _name: string,
    options: MockNodeOptions,
  ) {
    lastCtorOptions.value = options;
    this.parameters = new Map();
    this.port = { postMessage: vi.fn(), onmessage: null };
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type)!.push(listener);
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this._listeners.get(event.type) ?? [];
    for (const l of listeners) {
      if (typeof l === 'function') {
        l(event);
      } else {
        l.handleEvent(event);
      }
    }
    return true;
  }
}

describe('PhaseVocoderNode', () => {
  beforeEach(() => {
    vi.resetModules();
    lastCtorOptions.value = undefined;
    vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);
  });

  it('matches the shared processor constant', async () => {
    const { PhaseVocoderNode, PROCESSOR_NAME } = await import('./index.js');
    expect(PhaseVocoderNode.processorName).toBe(PROCESSOR_NAME);
  });

  it('calls audioWorklet.addModule with the given URL', async () => {
    const { PhaseVocoderNode } = await import('./index.js');
    const addModule = vi.fn().mockResolvedValue(undefined);
    const context = {
      audioWorklet: { addModule },
    } as unknown as BaseAudioContext;

    await PhaseVocoderNode.register(context, '/path/to/processor.js');
    expect(addModule).toHaveBeenCalledWith('/path/to/processor.js');
  });

  it('registers strategy installer modules in worklet scope', async () => {
    const { PhaseVocoderNode } = await import('./index.js');
    const addModule = vi.fn().mockResolvedValue(undefined);
    const context = {
      audioWorklet: { addModule },
    } as unknown as BaseAudioContext;

    await PhaseVocoderNode.registerStrategyModule(
      context,
      '/path/to/strategy.worklet.js',
    );

    expect(addModule).toHaveBeenCalledWith('/path/to/strategy.worklet.js');
  });

  it('accepts constructor options and exposes parameter accessors', async () => {
    const { PhaseVocoderNode } = await import('./index.js');
    const context = {} as BaseAudioContext;
    const node = new PhaseVocoderNode({
      context,
      sampleBufferType: 'fifo',
      interpolationStrategy: 'lanczos',
      fftSize: 1024,
      overlapFactor: 4,
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

  it('forwards fftSize and overlapFactor to processorOptions', async () => {
    const { PhaseVocoderNode } = await import('./index.js');
    new PhaseVocoderNode({
      context: {} as BaseAudioContext,
      fftSize: 1024,
      overlapFactor: 8,
    });
    expect(
      (lastCtorOptions.value?.processorOptions as Record<string, unknown>)
        ?.fftSize,
    ).toBe(1024);
    expect(
      (lastCtorOptions.value?.processorOptions as Record<string, unknown>)
        ?.overlapFactor,
    ).toBe(8);
  });

  it('uses default fftSize=2048 and overlapFactor=4 when not specified', async () => {
    const { PhaseVocoderNode } = await import('./index.js');
    new PhaseVocoderNode({ context: {} as BaseAudioContext });
    expect(
      (lastCtorOptions.value?.processorOptions as Record<string, unknown>)
        ?.fftSize,
    ).toBe(2048);
    expect(
      (lastCtorOptions.value?.processorOptions as Record<string, unknown>)
        ?.overlapFactor,
    ).toBe(4);
  });

  it('sends runtime strategy control messages via MessagePort', async () => {
    const { PhaseVocoderNode } = await import('./index.js');
    const context = {} as BaseAudioContext;
    const node = new PhaseVocoderNode({ context });

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
    const { PhaseVocoderNode } = await import('./index.js');
    const context = {} as BaseAudioContext;
    const node = new PhaseVocoderNode({ context });

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
      const { PhaseVocoderNode } = await import('./index.js');
      new PhaseVocoderNode({ context: {} as BaseAudioContext });
      expect(lastCtorOptions.value?.outputChannelCount).toEqual([2]);
    });

    it('passes [1] when outputChannelCount is 1', async () => {
      const { PhaseVocoderNode } = await import('./index.js');
      new PhaseVocoderNode({
        context: {} as BaseAudioContext,
        outputChannelCount: 1,
      });
      expect(lastCtorOptions.value?.outputChannelCount).toEqual([1]);
    });

    it('passes [2] when outputChannelCount is 2', async () => {
      const { PhaseVocoderNode } = await import('./index.js');
      new PhaseVocoderNode({
        context: {} as BaseAudioContext,
        outputChannelCount: 2,
      });
      expect(lastCtorOptions.value?.outputChannelCount).toEqual([2]);
    });
  });

  describe('metrics', () => {
    it('returns null before any metrics message is received', async () => {
      const { PhaseVocoderNode } = await import('./index.js');
      const node = new PhaseVocoderNode({ context: {} as BaseAudioContext });
      expect(node.metrics).toBeNull();
    });

    it('updates metrics getter when a metrics message arrives', async () => {
      vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(42) });
      const { PhaseVocoderNode } = await import('./index.js');
      const node = new PhaseVocoderNode({ context: {} as BaseAudioContext });

      const port = (
        node as unknown as {
          port: { onmessage: MessageListener | null };
        }
      ).port;

      port.onmessage!({
        data: {
          type: 'metrics',
          framesBuffered: 64,
          underrunCount: 2,
          blockCount: 100,
        },
      } as MessageEvent);

      expect(node.metrics).toEqual({
        framesBuffered: 64,
        underrunCount: 2,
        blockCount: 100,
        timestamp: 42,
      });
    });

    it('dispatches a metrics CustomEvent with the metrics detail', async () => {
      vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(99) });
      const { PhaseVocoderNode } = await import('./index.js');
      const node = new PhaseVocoderNode({ context: {} as BaseAudioContext });

      const received: unknown[] = [];
      node.addEventListener('metrics', (e) => {
        received.push((e as CustomEvent).detail);
      });

      const port = (
        node as unknown as {
          port: { onmessage: MessageListener | null };
        }
      ).port;

      port.onmessage!({
        data: {
          type: 'metrics',
          framesBuffered: 128,
          underrunCount: 0,
          blockCount: 200,
        },
      } as MessageEvent);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        framesBuffered: 128,
        underrunCount: 0,
        blockCount: 200,
        timestamp: 99,
      });
    });

    it('ignores non-metrics messages on the port', async () => {
      const { PhaseVocoderNode } = await import('./index.js');
      const node = new PhaseVocoderNode({ context: {} as BaseAudioContext });

      const port = (
        node as unknown as {
          port: { onmessage: MessageListener | null };
        }
      ).port;

      port.onmessage!({
        data: { type: 'unknown-type', value: 42 },
      } as MessageEvent);

      expect(node.metrics).toBeNull();
    });
  });
});
