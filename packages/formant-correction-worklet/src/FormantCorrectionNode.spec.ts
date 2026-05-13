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
      if (typeof l === 'function') l(event);
      else l.handleEvent(event);
    }
    return true;
  }
}

describe('FormantCorrectionNode', () => {
  beforeEach(() => {
    vi.resetModules();
    lastCtorOptions.value = undefined;
    vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);
  });

  it('matches the shared processor constant', async () => {
    const { FormantCorrectionNode, PROCESSOR_NAME } = await import('./index.js');
    expect(FormantCorrectionNode.processorName).toBe(PROCESSOR_NAME);
  });

  it('calls audioWorklet.addModule with the given URL', async () => {
    const { FormantCorrectionNode } = await import('./index.js');
    const addModule = vi.fn().mockResolvedValue(undefined);
    const context = { audioWorklet: { addModule } } as unknown as BaseAudioContext;
    await FormantCorrectionNode.register(context, '/formant-processor.js');
    expect(addModule).toHaveBeenCalledWith('/formant-processor.js');
  });

  it('registers strategy installer modules in worklet scope', async () => {
    const { FormantCorrectionNode } = await import('./index.js');
    const addModule = vi.fn().mockResolvedValue(undefined);
    const context = { audioWorklet: { addModule } } as unknown as BaseAudioContext;
    await FormantCorrectionNode.registerStrategyModule(context, '/strategy.js');
    expect(addModule).toHaveBeenCalledWith('/strategy.js');
  });

  it('accepts constructor options and exposes parameter accessors', async () => {
    const { FormantCorrectionNode } = await import('./index.js');
    const node = new FormantCorrectionNode({
      context: {} as BaseAudioContext,
      sampleBufferType: 'fifo',
      interpolationStrategy: 'lanczos',
    });

    const pitchParam = { value: 1.0 };
    const semitonesParam = { value: 0 };
    const rateParam = { value: 1.0 };
    const strengthParam = { value: 1.0 };

    (node as unknown as { parameters: Map<string, unknown> }).parameters =
      new Map([
        ['pitch', pitchParam],
        ['pitchSemitones', semitonesParam],
        ['playbackRate', rateParam],
        ['formantStrength', strengthParam],
      ]);

    expect(node.pitch).toBe(pitchParam);
    expect(node.pitchSemitones).toBe(semitonesParam);
    expect(node.playbackRate).toBe(rateParam);
    expect(node.formantStrength).toBe(strengthParam);
  });

  it('sends runtime strategy control messages via MessagePort', async () => {
    const { FormantCorrectionNode } = await import('./index.js');
    const node = new FormantCorrectionNode({ context: {} as BaseAudioContext });

    node.setInterpolationStrategy('lanczos');
    node.setInterpolationStrategyParams({ zeroCrossings: 4 });

    const port = (node as unknown as { port: { postMessage: ReturnType<typeof vi.fn> } }).port;
    expect(port.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'set-interpolation-strategy',
      strategy: 'lanczos',
    });
    expect(port.postMessage).toHaveBeenNthCalledWith(2, {
      type: 'set-interpolation-strategy-params',
      params: { zeroCrossings: 4 },
    });
  });

  it('sends set-stretch-parameters message via MessagePort', async () => {
    const { FormantCorrectionNode } = await import('./index.js');
    const node = new FormantCorrectionNode({ context: {} as BaseAudioContext });

    node.setStretchParameters({ overlapMs: 10 });

    const port = (node as unknown as { port: { postMessage: ReturnType<typeof vi.fn> } }).port;
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'set-stretch-parameters',
      params: { overlapMs: 10 },
    });
  });

  describe('outputChannelCount option', () => {
    it('defaults to stereo when not specified', async () => {
      const { FormantCorrectionNode } = await import('./index.js');
      new FormantCorrectionNode({ context: {} as BaseAudioContext });
      expect(lastCtorOptions.value?.outputChannelCount).toEqual([2]);
    });

    it('passes [1] when outputChannelCount is 1', async () => {
      const { FormantCorrectionNode } = await import('./index.js');
      new FormantCorrectionNode({ context: {} as BaseAudioContext, outputChannelCount: 1 });
      expect(lastCtorOptions.value?.outputChannelCount).toEqual([1]);
    });
  });

  describe('metrics', () => {
    it('returns null before any metrics message is received', async () => {
      const { FormantCorrectionNode } = await import('./index.js');
      const node = new FormantCorrectionNode({ context: {} as BaseAudioContext });
      expect(node.metrics).toBeNull();
    });

    it('updates metrics getter when a metrics message arrives', async () => {
      vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(55) });
      const { FormantCorrectionNode } = await import('./index.js');
      const node = new FormantCorrectionNode({ context: {} as BaseAudioContext });

      const port = (node as unknown as { port: { onmessage: MessageListener | null } }).port;
      port.onmessage!({
        data: { type: 'metrics', framesBuffered: 64, underrunCount: 1, blockCount: 100 },
      } as MessageEvent);

      expect(node.metrics).toEqual({
        framesBuffered: 64,
        underrunCount: 1,
        blockCount: 100,
        timestamp: 55,
      });
    });

    it('dispatches a metrics CustomEvent', async () => {
      vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(77) });
      const { FormantCorrectionNode } = await import('./index.js');
      const node = new FormantCorrectionNode({ context: {} as BaseAudioContext });

      const received: unknown[] = [];
      node.addEventListener('metrics', (e) => {
        received.push((e as CustomEvent).detail);
      });

      const port = (node as unknown as { port: { onmessage: MessageListener | null } }).port;
      port.onmessage!({
        data: { type: 'metrics', framesBuffered: 128, underrunCount: 0, blockCount: 200 },
      } as MessageEvent);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ framesBuffered: 128, timestamp: 77 });
    });

    it('ignores non-metrics messages', async () => {
      const { FormantCorrectionNode } = await import('./index.js');
      const node = new FormantCorrectionNode({ context: {} as BaseAudioContext });
      const port = (node as unknown as { port: { onmessage: MessageListener | null } }).port;
      port.onmessage!({ data: { type: 'other', value: 1 } } as MessageEvent);
      expect(node.metrics).toBeNull();
    });
  });
});
