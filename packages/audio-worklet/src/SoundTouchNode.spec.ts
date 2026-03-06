import { describe, it, expect, vi } from 'vitest';
import { SoundTouchNode, PROCESSOR_NAME } from './index.js';

describe('SoundTouchNode', () => {
  describe('processorName', () => {
    it('matches the shared constant', () => {
      expect(SoundTouchNode.processorName).toBe(PROCESSOR_NAME);
    });
  });

  describe('register', () => {
    it('calls audioWorklet.addModule with the given URL', async () => {
      const addModule = vi.fn().mockResolvedValue(undefined);
      const context = {
        audioWorklet: { addModule },
      } as unknown as BaseAudioContext;

      await SoundTouchNode.register(context, '/path/to/processor.js');
      expect(addModule).toHaveBeenCalledWith('/path/to/processor.js');
    });
  });

  describe('constructor', () => {
    it('creates an instance extending AudioWorkletNode', () => {
      const context = {} as BaseAudioContext;
      const node = new SoundTouchNode(context);
      expect(node).toBeInstanceOf(SoundTouchNode);
    });
  });

  describe('parameter accessors', () => {
    it('exposes pitch, tempo, rate, and pitchSemitones', () => {
      const context = {} as BaseAudioContext;
      const node = new SoundTouchNode(context);

      const pitchParam = { value: 1.0 };
      const tempoParam = { value: 1.0 };
      const rateParam = { value: 1.0 };
      const semitonesParam = { value: 0 };

      (node as unknown as { parameters: Map<string, unknown> }).parameters =
        new Map([
          ['pitch', pitchParam],
          ['tempo', tempoParam],
          ['rate', rateParam],
          ['pitchSemitones', semitonesParam],
        ]);

      expect(node.pitch).toBe(pitchParam);
      expect(node.tempo).toBe(tempoParam);
      expect(node.rate).toBe(rateParam);
      expect(node.pitchSemitones).toBe(semitonesParam);
    });
  });
});
