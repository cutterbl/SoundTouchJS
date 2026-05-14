import { describe, expect, it, beforeEach } from 'vitest';
import { PhaseVocoder, createPhaseVocoderFactory } from './PhaseVocoder.js';

class TestBuffer {
  private samples: Float32Array = new Float32Array(0);
  private _frameCount = 0;

  get frameCount(): number {
    return this._frameCount;
  }

  clear(): void {
    this.samples = new Float32Array(0);
    this._frameCount = 0;
  }

  putSamples(input: Float32Array, position = 0, numFrames = 0): void {
    const offset = position * 2;
    const frames =
      numFrames > 0 ? numFrames : Math.floor((input.length - offset) / 2);
    const next = new Float32Array(this.samples.length + frames * 2);
    next.set(this.samples);
    next.set(input.subarray(offset, offset + frames * 2), this.samples.length);
    this.samples = next;
    this._frameCount += frames;
  }

  extract(output: Float32Array, position = 0, numFrames = 0): void {
    const frames =
      numFrames > 0 ? numFrames : this._frameCount - position;
    const offset = position * 2;
    output.set(
      this.samples.subarray(offset, offset + frames * 2),
      0,
    );
  }

  receive(numFrames: number): void {
    const drop = Math.min(numFrames, this._frameCount);
    this.samples = this.samples.subarray(drop * 2);
    this._frameCount -= drop;
  }
}

function fillBuffer(buf: TestBuffer, frames: number, value = 0.5): void {
  const s = new Float32Array(frames * 2);
  for (let i = 0; i < frames * 2; i++) s[i] = value;
  buf.putSamples(s, 0, frames);
}

describe('PhaseVocoder', () => {
  let pv: PhaseVocoder;
  let inputBuf: TestBuffer;
  let outputBuf: TestBuffer;

  beforeEach(() => {
    pv = new PhaseVocoder({ fftSize: 512, overlapFactor: 4 });
    inputBuf = new TestBuffer();
    outputBuf = new TestBuffer();
    pv.inputBuffer = inputBuf as unknown as import('@soundtouchjs/core').SampleBuffer;
    pv.outputBuffer = outputBuf as unknown as import('@soundtouchjs/core').SampleBuffer;
  });

  describe('configuration', () => {
    it('sampleReq equals analysisHop (fftSize / overlapFactor)', () => {
      expect(pv.sampleReq).toBe(512 / 4);
    });

    it('tempo defaults to 1.0', () => {
      expect(pv.tempo).toBe(1.0);
    });

    it('tempo setter updates the value', () => {
      pv.tempo = 0.75;
      expect(pv.tempo).toBe(0.75);
    });

    it('uses fftSize 2048 and overlapFactor 4 by default', () => {
      const defaultPv = new PhaseVocoder();
      expect(defaultPv.sampleReq).toBe(2048 / 4);
    });
  });

  describe('no-op guards', () => {
    it('process() does nothing when inputBuffer is null', () => {
      pv.inputBuffer = null;
      fillBuffer(inputBuf, pv.sampleReq);
      expect(() => pv.process()).not.toThrow();
      expect(outputBuf.frameCount).toBe(0);
    });

    it('process() does nothing when outputBuffer is null', () => {
      pv.outputBuffer = null;
      fillBuffer(inputBuf, pv.sampleReq);
      expect(() => pv.process()).not.toThrow();
    });

    it('process() does nothing when inputBuffer has fewer than sampleReq frames', () => {
      fillBuffer(inputBuf, pv.sampleReq - 1);
      pv.process();
      expect(outputBuf.frameCount).toBe(0);
    });
  });

  describe('setParameters and setStretchParameters', () => {
    it('setParameters does not throw', () => {
      expect(() => pv.setParameters(44100, 80, 25, 8)).not.toThrow();
    });

    it('setStretchParameters does not throw', () => {
      expect(() =>
        pv.setStretchParameters({ overlapMs: 12, quickSeek: false }),
      ).not.toThrow();
    });
  });

  describe('process()', () => {
    it('produces output frames when input has enough data', () => {
      fillBuffer(inputBuf, pv.sampleReq);
      pv.process();
      expect(outputBuf.frameCount).toBeGreaterThan(0);
    });

    it('consumes exactly sampleReq frames per call', () => {
      const total = pv.sampleReq * 3;
      fillBuffer(inputBuf, total);
      const before = inputBuf.frameCount;
      pv.process();
      expect(before - inputBuf.frameCount).toBe(pv.sampleReq);
    });

    it('produces finite output values', () => {
      const Ha = pv.sampleReq;
      fillBuffer(inputBuf, Ha);
      pv.process();

      const out = new Float32Array(outputBuf.frameCount * 2);
      outputBuf.extract(out, 0, outputBuf.frameCount);
      for (let i = 0; i < out.length; i++) {
        expect(Number.isFinite(out[i])).toBe(true);
      }
    });

    it('output frame count equals round(Ha / tempo)', () => {
      pv.tempo = 2.0;
      const Ha = pv.sampleReq;
      fillBuffer(inputBuf, Ha);
      pv.process();
      expect(outputBuf.frameCount).toBe(Math.round(Ha / 2.0));
    });

    it('tempo = 0.5 produces more output frames than tempo = 1.0', () => {
      const Ha = pv.sampleReq;

      const pv1 = new PhaseVocoder({ fftSize: 512, overlapFactor: 4 });
      const in1 = new TestBuffer();
      const out1 = new TestBuffer();
      pv1.inputBuffer = in1 as unknown as import('@soundtouchjs/core').SampleBuffer;
      pv1.outputBuffer = out1 as unknown as import('@soundtouchjs/core').SampleBuffer;
      pv1.tempo = 1.0;
      fillBuffer(in1, Ha);
      pv1.process();

      const pv05 = new PhaseVocoder({ fftSize: 512, overlapFactor: 4 });
      const in05 = new TestBuffer();
      const out05 = new TestBuffer();
      pv05.inputBuffer = in05 as unknown as import('@soundtouchjs/core').SampleBuffer;
      pv05.outputBuffer = out05 as unknown as import('@soundtouchjs/core').SampleBuffer;
      pv05.tempo = 0.5;
      fillBuffer(in05, Ha);
      pv05.process();

      expect(out05.frameCount).toBeGreaterThan(out1.frameCount);
    });
  });

  describe('clear() and clearMidBuffer()', () => {
    it('clear() resets state so process() starts fresh', () => {
      fillBuffer(inputBuf, pv.sampleReq * 4);
      pv.process();
      pv.process();
      const countBefore = outputBuf.frameCount;

      pv.clear();
      outputBuf.clear();
      fillBuffer(inputBuf, pv.sampleReq);
      pv.process();
      // After clear, first process produces same amount as a fresh PV
      const pvFresh = new PhaseVocoder({ fftSize: 512, overlapFactor: 4 });
      const inFresh = new TestBuffer();
      const outFresh = new TestBuffer();
      pvFresh.inputBuffer = inFresh as unknown as import('@soundtouchjs/core').SampleBuffer;
      pvFresh.outputBuffer = outFresh as unknown as import('@soundtouchjs/core').SampleBuffer;
      fillBuffer(inFresh, pv.sampleReq);
      pvFresh.process();
      expect(outputBuf.frameCount).toBe(outFresh.frameCount);
      void countBefore;
    });

    it('clearMidBuffer() does not throw', () => {
      fillBuffer(inputBuf, pv.sampleReq);
      pv.process();
      expect(() => pv.clearMidBuffer()).not.toThrow();
    });
  });

  describe('clone()', () => {
    it('clone returns a different instance', () => {
      expect(pv.clone()).not.toBe(pv);
    });

    it('clone has the same sampleReq', () => {
      const c = pv.clone();
      expect(c.sampleReq).toBe(pv.sampleReq);
    });

    it('clone inherits current tempo', () => {
      pv.tempo = 1.5;
      const c = pv.clone();
      expect(c.tempo).toBe(1.5);
    });

    it('clone is independent — setting tempo does not affect original', () => {
      const c = pv.clone();
      c.tempo = 2.0;
      expect(pv.tempo).toBe(1.0);
    });
  });
});

describe('createPhaseVocoderFactory', () => {
  it('returns a factory that creates PhaseVocoder instances', () => {
    const factory = createPhaseVocoderFactory(512, 4);
    const pv = factory(44100, {
      sampleBufferFactory: () => ({} as import('@soundtouchjs/core').SampleBuffer),
      sampleBufferType: 'circular',
    });
    expect(pv).toBeInstanceOf(PhaseVocoder);
  });

  it('uses default fftSize=2048 and overlapFactor=4', () => {
    const factory = createPhaseVocoderFactory();
    const pv = factory(44100, {
      sampleBufferFactory: () => ({} as import('@soundtouchjs/core').SampleBuffer),
      sampleBufferType: 'circular',
    });
    expect(pv.sampleReq).toBe(2048 / 4);
  });

  it('factory-created vocoder accepts custom fftSize', () => {
    const factory = createPhaseVocoderFactory(1024, 4);
    const pv = factory(44100, {
      sampleBufferFactory: () => ({} as import('@soundtouchjs/core').SampleBuffer),
      sampleBufferType: 'circular',
    });
    expect(pv.sampleReq).toBe(1024 / 4);
  });
});
