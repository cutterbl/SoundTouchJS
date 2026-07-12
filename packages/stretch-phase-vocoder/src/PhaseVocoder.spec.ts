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

const TWO_PI = 2 * Math.PI;

// Bin-aligned test tone: bin 16 of a 512-point FFT → period 32 samples.
const OMEGA = (TWO_PI * 16) / 512;

function fillSine(
  buf: TestBuffer,
  frames: number,
  omega: number,
  phaseL = 0,
  phaseR = 0,
  amp = 0.5,
): void {
  const s = new Float32Array(frames * 2);
  for (let i = 0; i < frames; i++) {
    s[i * 2] = amp * Math.sin(omega * i + phaseL);
    s[i * 2 + 1] = amp * Math.sin(omega * i + phaseR);
  }
  buf.putSamples(s, 0, frames);
}

function allOutput(buf: TestBuffer): Float32Array {
  const out = new Float32Array(buf.frameCount * 2);
  buf.extract(out, 0, buf.frameCount);
  return out;
}

// RMS across both channels of interleaved frames [from, to).
function rmsInterleaved(x: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let n = from; n < to; n++) {
    sum += x[n * 2] ** 2 + x[n * 2 + 1] ** 2;
  }
  return Math.sqrt(sum / (2 * (to - from)));
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

    it('accepts a sampleRate option for Stretch compatibility', () => {
      expect(
        () => new PhaseVocoder({ sampleRate: 48000, fftSize: 512 }),
      ).not.toThrow();
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

  // Warmup rationale: the analysis window fills after N/Ha = 4 hops, the
  // phase recursion is valid from the 2nd frame, and the OLA reaches steady
  // state after ⌈N/Hs⌉ frames. Skipping the first 16 hops of output is
  // comfortably past every transient, and 16·Hs frames is a whole number of
  // the 32-sample test-tone periods.
  describe('DSP correctness', () => {
    const WARMUP_HOPS = 16;

    it('preserves RMS at tempo 1.0 for a bin-aligned sine', () => {
      const Ha = pv.sampleReq;
      const hops = 64;
      fillSine(inputBuf, hops * Ha, OMEGA);
      for (let i = 0; i < hops; i++) pv.process();

      const out = allOutput(outputBuf);
      const outRms = rmsInterleaved(out, WARMUP_HOPS * Ha, hops * Ha);
      const inRms = 0.5 / Math.SQRT2;
      const dB = 20 * Math.log10(outRms / inRms);
      expect(Math.abs(dB)).toBeLessThan(0.5);
    });

    for (const tempo of [0.8, 1.25, 2.0]) {
      it(`preserves RMS at tempo ${tempo}`, () => {
        const Ha = pv.sampleReq;
        const Hs = Math.max(1, Math.round(Ha / tempo));
        const hops = 64;
        pv.tempo = tempo;
        fillSine(inputBuf, hops * Ha, OMEGA);
        for (let i = 0; i < hops; i++) pv.process();

        const out = allOutput(outputBuf);
        const outRms = rmsInterleaved(out, WARMUP_HOPS * Hs, hops * Hs);
        const dB = 20 * Math.log10(outRms / (0.5 / Math.SQRT2));
        expect(Math.abs(dB)).toBeLessThan(0.5);
      });
    }

    it('reproduces a DC signal at unity level for tempo 1.0', () => {
      const Ha = pv.sampleReq;
      const hops = 32;
      fillBuffer(inputBuf, hops * Ha, 0.5);
      for (let i = 0; i < hops; i++) pv.process();

      const out = allOutput(outputBuf);
      for (let n = WARMUP_HOPS * Ha; n < hops * Ha; n++) {
        expect(Math.abs(out[n * 2] - 0.5)).toBeLessThan(1e-3);
        expect(Math.abs(out[n * 2 + 1] - 0.5)).toBeLessThan(1e-3);
      }
    });

    it('produces identical outputs for identical L/R inputs', () => {
      pv.tempo = 1.25;
      const hops = 48;
      fillSine(inputBuf, hops * pv.sampleReq, OMEGA, 0.4, 0.4);
      for (let i = 0; i < hops; i++) pv.process();

      const out = allOutput(outputBuf);
      for (let i = 0; i < out.length; i += 2) {
        expect(Math.abs(out[i] - out[i + 1])).toBeLessThanOrEqual(1e-6);
      }
    });

    it('preserves a fixed inter-channel phase offset at tempo 1.0', () => {
      const phi = Math.PI / 3;
      const Ha = pv.sampleReq;
      const hops = 64;
      fillSine(inputBuf, hops * Ha, OMEGA, 0, phi);
      for (let i = 0; i < hops; i++) pv.process();

      // Complex demodulation at the tone frequency over whole periods: for
      // a·sin(ωn + φ), arg(Σ x[n]·e^(−iωn)) = φ − π/2, so the L/R argument
      // difference is exactly φ.
      const out = allOutput(outputBuf);
      let reLh = 0;
      let imLh = 0;
      let reRh = 0;
      let imRh = 0;
      for (let n = WARMUP_HOPS * Ha; n < hops * Ha; n++) {
        const c = Math.cos(OMEGA * n);
        const s = Math.sin(OMEGA * n);
        reLh += out[n * 2] * c;
        imLh -= out[n * 2] * s;
        reRh += out[n * 2 + 1] * c;
        imRh -= out[n * 2 + 1] * s;
      }
      let diff = Math.atan2(imRh, reRh) - Math.atan2(imLh, reLh);
      diff -= TWO_PI * Math.round(diff / TWO_PI);
      expect(Math.abs(diff - phi)).toBeLessThan(0.05);
    });

    it('keeps phase state bounded and channels coherent after many frames', () => {
      pv.tempo = 1.25;
      const hops = 400;
      fillSine(inputBuf, hops * pv.sampleReq, OMEGA, 0.2, 0.2);
      for (let i = 0; i < hops; i++) pv.process();

      // Phase state is carried as complex spectra; magnitudes must stay
      // finite and bounded by the frame energy (no runaway accumulation).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sRe = (pv as any).synthMidRe as Float32Array;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sIm = (pv as any).synthMidIm as Float32Array;
      for (let k = 0; k < sRe.length; k++) {
        expect(Number.isFinite(sRe[k])).toBe(true);
        expect(Number.isFinite(sIm[k])).toBe(true);
      }

      const out = allOutput(outputBuf);
      for (let i = 0; i < out.length; i += 2) {
        expect(Math.abs(out[i] - out[i + 1])).toBeLessThanOrEqual(1e-6);
      }
    });

    for (const semis of [2, -2]) {
      it(`preserves broadband noise level at ${semis > 0 ? '+' : ''}${semis} semitones equivalent tempo`, () => {
        // Without peak phase locking, the per-bin recursion re-randomizes
        // local phase structure once Hs ≠ Ha and noise-like content loses
        // ~3 dB to incoherent overlap-add.
        const tempo = Math.pow(2, -semis / 12);
        pv.tempo = tempo;
        const Ha = pv.sampleReq;
        const Hs = Math.max(1, Math.round(Ha / tempo));
        const hops = 128;

        // Deterministic LCG noise, identical L/R.
        let seed = 12345 >>> 0;
        const rng = () => {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          return seed / 0xffffffff - 0.5;
        };
        const frames = hops * Ha;
        const s = new Float32Array(frames * 2);
        let inSum = 0;
        for (let i = 0; i < frames; i++) {
          const v = 0.5 * rng();
          s[i * 2] = v;
          s[i * 2 + 1] = v;
          inSum += v * v;
        }
        const inRms = Math.sqrt(inSum / frames);
        inputBuf.putSamples(s, 0, frames);
        for (let i = 0; i < hops; i++) pv.process();

        const out = allOutput(outputBuf);
        const outRms = rmsInterleaved(out, WARMUP_HOPS * Hs, hops * Hs);
        const dB = 20 * Math.log10(outRms / inRms);
        expect(Math.abs(dB)).toBeLessThan(1.5);
      });
    }

    it('stays level-stable across a mid-stream tempo change', () => {
      const Ha = pv.sampleReq;
      fillSine(inputBuf, 64 * Ha, OMEGA);
      for (let i = 0; i < 32; i++) pv.process();
      pv.tempo = 2.0;
      for (let i = 0; i < 32; i++) pv.process();

      const out = allOutput(outputBuf);
      const frames = out.length / 2;
      for (let i = 0; i < out.length; i++) {
        expect(Number.isFinite(out[i])).toBe(true);
      }
      const Hs2 = Math.round(Ha / 2.0);
      const outRms = rmsInterleaved(out, frames - 16 * Hs2, frames);
      const dB = 20 * Math.log10(outRms / (0.5 / Math.SQRT2));
      expect(Math.abs(dB)).toBeLessThan(1.5);
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

  it('accepts the factory sample rate without changing algorithm behavior', () => {
    const factory = createPhaseVocoderFactory(1024, 4);
    const pv = factory(48000, {
      sampleBufferFactory: () => ({} as import('@soundtouchjs/core').SampleBuffer),
      sampleBufferType: 'circular',
    });

    expect(pv).toBeInstanceOf(PhaseVocoder);
    expect(pv.sampleReq).toBe(1024 / 4);
  });
});
