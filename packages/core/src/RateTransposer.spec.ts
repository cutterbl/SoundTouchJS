import {
  hasInterpolationStrategy,
  registerInterpolationStrategy,
  unregisterInterpolationStrategy,
} from './interpolationStrategyRegistry.js';
it('uses a custom plugin kernel for interpolation', () => {
  // Kernel returns a constant value for all output
  const testKernel = function (
    src,
    srcOffset,
    numFrames,
    position,
    channel,
    state,
  ) {
    return channel === 0 ? 123 : 456;
  };
  registerInterpolationStrategy({
    id: 'plugin/constant',
    kernel: testKernel,
  });
  const rt = new RateTransposer({
    createBuffers: true,
    interpolationStrategy: 'plugin/constant',
  });
  rt.rate = 1.0;
  const samples = new Float32Array(10);
  for (let i = 0; i < 10; i++) samples[i] = i;
  rt.inputBuffer!.putSamples(samples);
  rt.process();
  const outputFrames = rt.outputBuffer!.frameCount;
  expect(outputFrames).toBeGreaterThan(0);
  const extracted = new Float32Array(outputFrames * 2);
  rt.outputBuffer!.extract(extracted, 0, outputFrames);
  for (let i = 0; i < extracted.length; i += 2) {
    expect(extracted[i]).toBe(123);
    expect(extracted[i + 1]).toBe(456);
  }
  unregisterInterpolationStrategy('plugin/constant');
});
// Simple FFT implementation for power-of-two real signals (Radix-2 Cooley-Tukey)
function fftReal(signal: Float32Array): { re: Float32Array; im: Float32Array } {
  const N = signal.length;
  if ((N & (N - 1)) !== 0) throw new Error('Length must be power of 2');
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let i = 0; i < N; i++) re[i] = signal[i];
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < N; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let m = N >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }
  // Danielson-Lanczos
  for (let size = 2; size <= N; size <<= 1) {
    const halfsize = size >> 1;
    const tablestep = (Math.PI * 2) / size;
    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < halfsize; j++) {
        const k = i + j;
        const l = k + halfsize;
        const angle = tablestep * j;
        const tpre = Math.cos(angle) * re[l] + Math.sin(angle) * im[l];
        const tpim = -Math.sin(angle) * re[l] + Math.cos(angle) * im[l];
        re[l] = re[k] - tpre;
        im[l] = im[k] - tpim;
        re[k] += tpre;
        im[k] += tpim;
      }
    }
  }
  return { re, im };
}

function computeAliasBandEnergy(
  interleaved: Float32Array,
  channel: 0 | 1,
  startFrame: number,
  frameCount: number,
  cutoffRatio: number,
): number {
  // Extract channel, zero-pad to next power of 2
  const N = 1 << Math.ceil(Math.log2(frameCount));
  const signal = new Float32Array(N);
  for (let i = 0; i < frameCount; i++) {
    signal[i] = interleaved[2 * (startFrame + i) + channel];
  }
  for (let i = frameCount; i < N; i++) signal[i] = 0;
  const { re, im } = fftReal(signal);
  // Compute magnitude spectrum
  const magsq = new Float32Array(N / 2);
  for (let k = 0; k < N / 2; k++) {
    magsq[k] = re[k] * re[k] + im[k] * im[k];
  }
  // Sum energy above cutoff
  const cutoffBin = Math.floor((N / 2) * cutoffRatio);
  let aliasEnergy = 0;
  let totalEnergy = 0;
  for (let k = 0; k < N / 2; k++) {
    totalEnergy += magsq[k];
    if (k >= cutoffBin) aliasEnergy += magsq[k];
  }
  return aliasEnergy / (totalEnergy + 1e-12);
}
import { describe, it, expect } from 'vitest';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import RateTransposer from './RateTransposer.js';
import { createCircularSampleBufferAdapter } from './SampleBufferAdapter.js';
import type { SampleBuffer } from './SampleBuffer.js';

class TestSampleBuffer implements SampleBuffer {
  private readonly data: Float32Array;
  private consumedFrames: number;

  constructor(data: Float32Array) {
    this.data = data;
    this.consumedFrames = 0;
  }

  get frameCount(): number {
    return Math.max(0, this.data.length / 2 - this.consumedFrames);
  }

  clear(): void {
    this.consumedFrames = this.data.length / 2;
  }

  putSamples(
    _samples: Float32Array,
    _position?: number,
    _numFrames?: number,
  ): void {
    throw new Error('not implemented for test');
  }

  extract(output: Float32Array, position = 0, numFrames = 0): void {
    const available = Math.max(0, this.frameCount - position);
    const framesToCopy =
      numFrames > 0 ? Math.min(numFrames, available) : available;
    const startFrame = this.consumedFrames + position;
    const start = startFrame * 2;
    const end = start + framesToCopy * 2;
    output.set(this.data.subarray(start, end), 0);
  }

  receive(numFrames = this.frameCount): void {
    this.consumedFrames = Math.min(
      this.consumedFrames + numFrames,
      this.data.length / 2,
    );
  }
}

class TestWritableSampleBuffer implements SampleBuffer {
  private buffer: Float32Array;
  private _frameCount: number;

  constructor() {
    this.buffer = new Float32Array(0);
    this._frameCount = 0;
  }

  get frameCount(): number {
    return this._frameCount;
  }

  clear(): void {
    this.buffer = new Float32Array(0);
    this._frameCount = 0;
  }

  putSamples(samples: Float32Array, position = 0, numFrames = 0): void {
    const sourceOffset = position * 2;
    const framesToWrite =
      numFrames > 0
        ? numFrames
        : Math.floor((samples.length - sourceOffset) / 2);
    const samplesToWrite = framesToWrite * 2;

    const next = new Float32Array(this.buffer.length + samplesToWrite);
    next.set(this.buffer, 0);
    next.set(
      samples.subarray(sourceOffset, sourceOffset + samplesToWrite),
      this.buffer.length,
    );
    this.buffer = next;
    this._frameCount += framesToWrite;
  }

  extract(output: Float32Array, position = 0, numFrames = 0): void {
    const framesToRead =
      numFrames > 0 ? numFrames : this._frameCount - position;
    const sourceOffset = position * 2;
    const sampleCount = Math.max(0, framesToRead) * 2;
    output.set(
      this.buffer.subarray(sourceOffset, sourceOffset + sampleCount),
      0,
    );
  }

  receive(numFrames = this._frameCount): void {
    const framesToDrop = Math.min(Math.max(0, numFrames), this._frameCount);
    const sampleOffset = framesToDrop * 2;
    this.buffer = this.buffer.subarray(sampleOffset);
    this._frameCount -= framesToDrop;
  }
}

function createStereoSignal(frameCount: number): Float32Array {
  const samples = new Float32Array(frameCount * 2);
  for (let i = 0; i < frameCount; i++) {
    const t = i / frameCount;
    samples[2 * i] =
      0.75 * Math.sin(2 * Math.PI * (0.02 + 0.18 * t) * i) +
      0.1 * Math.sin(2 * Math.PI * 0.31 * i);
    samples[2 * i + 1] =
      0.7 * Math.sin(2 * Math.PI * (0.018 + 0.16 * t) * i + 0.35) +
      0.12 * Math.sin(2 * Math.PI * 0.27 * i + 0.2);
  }
  return samples;
}

function processInBlocks(
  strategy: 'linear' | 'lanczos',
  rate: number,
  inputFrames: number,
  blockFrames: number,
): Float32Array {
  ensureLinearStrategyRegistered();
  const rt = new RateTransposer({
    createBuffers: true,
    interpolationStrategy: strategy,
  });
  rt.rate = rate;

  const source = createStereoSignal(inputFrames);
  const chunks: Float32Array[] = [];

  for (let frame = 0; frame < inputFrames; frame += blockFrames) {
    const framesThisBlock = Math.min(blockFrames, inputFrames - frame);
    const start = frame * 2;
    const end = start + framesThisBlock * 2;
    rt.inputBuffer!.putSamples(source.subarray(start, end));
    rt.process();

    const outFrames = rt.outputBuffer!.frameCount;
    if (outFrames > 0) {
      const out = new Float32Array(outFrames * 2);
      rt.outputBuffer!.extract(out, 0, outFrames);
      rt.outputBuffer!.receive(outFrames);
      chunks.push(out);
    }
  }

  const totalSamples = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const merged = new Float32Array(totalSamples);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function createStereoSineSignal(
  frameCount: number,
  frequency: number,
): Float32Array {
  const samples = new Float32Array(frameCount * 2);
  for (let i = 0; i < frameCount; i++) {
    const value = Math.sin(2 * Math.PI * frequency * i);
    samples[2 * i] = value;
    samples[2 * i + 1] = value;
  }
  return samples;
}

function transposeSignalInBlocks(
  strategy: 'linear' | 'lanczos',
  rate: number,
  sourceInterleaved: Float32Array,
  blockFrames: number,
): Float32Array {
  ensureLinearStrategyRegistered();
  const rt = new RateTransposer({
    createBuffers: true,
    interpolationStrategy: strategy,
  });
  rt.rate = rate;

  const inputFrames = Math.floor(sourceInterleaved.length / 2);
  const chunks: Float32Array[] = [];

  for (let frame = 0; frame < inputFrames; frame += blockFrames) {
    const framesThisBlock = Math.min(blockFrames, inputFrames - frame);
    const start = frame * 2;
    const end = start + framesThisBlock * 2;
    rt.inputBuffer!.putSamples(sourceInterleaved.subarray(start, end));
    rt.process();

    const outFrames = rt.outputBuffer!.frameCount;
    if (outFrames > 0) {
      const out = new Float32Array(outFrames * 2);
      rt.outputBuffer!.extract(out, 0, outFrames);
      rt.outputBuffer!.receive(outFrames);
      chunks.push(out);
    }
  }

  const totalSamples = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const merged = new Float32Array(totalSamples);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function ensureLinearStrategyRegistered(): void {
  if (hasInterpolationStrategy('linear')) {
    return;
  }

  const linearKernel = (
    src,
    srcOffset,
    numFrames,
    position,
    channel,
    state,
  ) => {
    const typedState = state as { prevSampleL: number; prevSampleR: number };
    const left = Math.floor(position);
    const right = left + 1;
    const frac = position - left;

    const readFrameSample = (frameIndex: number): number => {
      if (frameIndex < 0) {
        return channel === 0 ? typedState.prevSampleL : typedState.prevSampleR;
      }

      if (frameIndex >= numFrames) {
        return src[srcOffset + 2 * (numFrames - 1) + channel];
      }

      return src[srcOffset + 2 * frameIndex + channel];
    };

    return (1 - frac) * readFrameSample(left) + frac * readFrameSample(right);
  };

  linearKernel.createState = () => ({ prevSampleL: 0, prevSampleR: 0 });

  registerInterpolationStrategy({
    id: 'linear',
    baseStrategy: 'linear',
    kernel: linearKernel,
  });
}

function estimateSineResidualRmse(
  interleavedSignal: Float32Array,
  normalizedFrequency: number,
  startFrame: number,
  channel: 0 | 1,
): { signalRmse: number; residualRmse: number } {
  const totalFrames = Math.floor(interleavedSignal.length / 2);
  const begin = Math.max(0, Math.min(startFrame, totalFrames));

  let ss = 0;
  let cc = 0;
  let sc = 0;
  let sy = 0;
  let cy = 0;

  for (let i = begin; i < totalFrames; i++) {
    const phase = 2 * Math.PI * normalizedFrequency * i;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const y = interleavedSignal[2 * i + channel];

    ss += s * s;
    cc += c * c;
    sc += s * c;
    sy += s * y;
    cy += c * y;
  }

  const det = ss * cc - sc * sc;
  if (det === 0) {
    return { signalRmse: 0, residualRmse: Number.POSITIVE_INFINITY };
  }

  const a = (sy * cc - cy * sc) / det;
  const b = (cy * ss - sy * sc) / det;

  let signalEnergy = 0;
  let residualEnergy = 0;
  let count = 0;

  for (let i = begin; i < totalFrames; i++) {
    const phase = 2 * Math.PI * normalizedFrequency * i;
    const estimate = a * Math.sin(phase) + b * Math.cos(phase);
    const y = interleavedSignal[2 * i + channel];
    signalEnergy += y * y;
    const residual = y - estimate;
    residualEnergy += residual * residual;
    count += 1;
  }

  if (count === 0) {
    return { signalRmse: 0, residualRmse: Number.POSITIVE_INFINITY };
  }

  return {
    signalRmse: Math.sqrt(signalEnergy / count),
    residualRmse: Math.sqrt(residualEnergy / count),
  };
}

describe('RateTransposer', () => {
  describe('constructor', () => {
    it('creates with buffers when requested', () => {
      const rt = new RateTransposer({ createBuffers: true });
      expect(rt.inputBuffer).not.toBeNull();
      expect(rt.outputBuffer).not.toBeNull();
    });

    it('creates without buffers by default', () => {
      const rt = new RateTransposer();
      expect(rt.inputBuffer).toBeNull();
      expect(rt.outputBuffer).toBeNull();
    });

    it('accepts interpolationStrategy option', () => {
      const rt = new RateTransposer({ interpolationStrategy: 'lanczos' });
      expect(rt.strategy).toBe('lanczos');
      expect(rt.inputBuffer).toBeNull();
      expect(rt.outputBuffer).toBeNull();
    });
  });

  describe('rate setter', () => {
    it('accepts a rate value without throwing', () => {
      const rt = new RateTransposer({ createBuffers: true });
      expect(() => {
        rt.rate = 2.0;
      }).not.toThrow();
    });
  });

  describe('clone', () => {
    it('produces a new independent instance', () => {
      const rt = new RateTransposer({ createBuffers: true });
      rt.rate = 1.5;
      const cloned = rt.clone();
      expect(cloned).not.toBe(rt);
      expect(cloned).toBeInstanceOf(RateTransposer);
    });
  });

  describe('runtime strategy updates', () => {
    it('switches strategy at runtime', () => {
      ensureLinearStrategyRegistered();
      const rt = new RateTransposer({
        createBuffers: true,
        interpolationStrategy: 'lanczos',
      });

      rt.setInterpolationStrategy('linear');

      expect(rt.strategy).toBe('linear');
    });

    it('updates strategy params at runtime', () => {
      const rt = new RateTransposer({
        createBuffers: true,
        interpolationStrategy: {
          id: 'lanczos',
          params: { zeroCrossings: 4 },
        },
      });

      expect(rt.strategyParams['zeroCrossings']).toBe(4);

      rt.setInterpolationStrategyParams({ zeroCrossings: 7 });

      expect(rt.strategyParams['zeroCrossings']).toBe(7);
    });

    it('preserves strategy params when cloned', () => {
      const rt = new RateTransposer({
        createBuffers: true,
        interpolationStrategy: {
          id: 'lanczos',
          params: { zeroCrossings: 5 },
        },
      });

      const cloned = rt.clone();

      expect(cloned.strategy).toBe('lanczos');
      expect(cloned.strategyParams['zeroCrossings']).toBe(5);
    });
  });

  describe('clear', () => {
    it('resets internal state and buffers', () => {
      const rt = new RateTransposer({ createBuffers: true });
      rt.inputBuffer!.putSamples(new Float32Array([1, 2, 3, 4]));
      rt.clear();
      expect(rt.inputBuffer!.frameCount).toBe(0);
      expect(rt.outputBuffer!.frameCount).toBe(0);
    });
  });

  describe('transpose', () => {
    it('returns 0 for 0 input frames', () => {
      const rt = new RateTransposer({ createBuffers: true });
      rt.rate = 1.0;
      expect(rt.transpose(0)).toBe(0);
    });

    it('returns 0 when frames are requested without any bound input data', () => {
      const rt = new RateTransposer({ createBuffers: false });
      rt.rate = 1.0;

      expect(rt.transpose(4)).toBe(0);
    });

    it('handles a single input frame without entering the main interpolation loop', () => {
      const rt = new RateTransposer({ createBuffers: true });
      rt.rate = 1.0;
      rt.inputBuffer!.putSamples(new Float32Array([1, 2]));

      expect(rt.transpose(1)).toBeGreaterThan(0);
    });

    it('produces output frames at rate 1.0', () => {
      const rt = new RateTransposer({ createBuffers: true });
      rt.rate = 1.0;

      const samples = new Float32Array(20);
      for (let i = 0; i < 20; i++) {
        samples[i] = i;
      }
      rt.inputBuffer!.putSamples(samples);

      const numOut = rt.transpose(10);
      expect(numOut).toBeGreaterThan(0);
    });

    it('produces fewer frames when rate > 1', () => {
      const rt1 = new RateTransposer({ createBuffers: true });
      rt1.rate = 1.0;
      const samples1 = new Float32Array(40);
      for (let i = 0; i < 40; i++) samples1[i] = Math.sin(i * 0.1);
      rt1.inputBuffer!.putSamples(samples1);
      const out1 = rt1.transpose(20);

      const rt2 = new RateTransposer({ createBuffers: true });
      rt2.rate = 2.0;
      const samples2 = new Float32Array(40);
      for (let i = 0; i < 40; i++) samples2[i] = Math.sin(i * 0.1);
      rt2.inputBuffer!.putSamples(samples2);
      const out2 = rt2.transpose(20);

      expect(out2).toBeLessThan(out1);
    });

    it('produces finite output when lanczos interpolation is selected', () => {
      const rt = new RateTransposer({
        createBuffers: true,
        interpolationStrategy: 'lanczos',
      });
      rt.rate = 1.0;

      const samples = new Float32Array(40);
      for (let i = 0; i < 40; i++) {
        samples[i] = Math.sin(i * 0.07);
      }
      rt.inputBuffer!.putSamples(samples);

      rt.process();

      const outputFrames = rt.outputBuffer!.frameCount;
      expect(outputFrames).toBeGreaterThan(0);

      const extracted = new Float32Array(outputFrames * 2);
      rt.outputBuffer!.extract(extracted, 0, outputFrames);
      for (let i = 0; i < extracted.length; i++) {
        expect(Number.isFinite(extracted[i])).toBe(true);
      }
    });

    it('stays finite and bounded across repeated 128-frame lanczos blocks', () => {
      const output = processInBlocks('lanczos', 1.17, 4096, 128);

      expect(output.length).toBeGreaterThan(0);

      let maxStep = 0;
      let peak = 0;
      for (let i = 0; i < output.length; i++) {
        const value = output[i];
        expect(Number.isFinite(value)).toBe(true);

        const absValue = Math.abs(value);
        if (absValue > peak) {
          peak = absValue;
        }

        if (i > 0) {
          const step = Math.abs(value - output[i - 1]);
          if (step > maxStep) {
            maxStep = step;
          }
        }
      }

      expect(peak).toBeLessThan(2.5);
      expect(maxStep).toBeLessThan(2.0);
    });

    it('produces a different waveform than linear for the same chunked input', () => {
      const linear = processInBlocks('linear', 1.33, 3072, 113);
      const lanczos = processInBlocks('lanczos', 1.33, 3072, 113);

      expect(lanczos.length).toBe(linear.length);

      let maxDifference = 0;
      for (let i = 0; i < linear.length; i++) {
        const diff = Math.abs(lanczos[i] - linear[i]);
        if (diff > maxDifference) {
          maxDifference = diff;
        }
      }

      expect(maxDifference).toBeGreaterThan(1e-5);
    });

    it('improves sinusoid fidelity against a fitted ideal tone at high frequency', () => {
      const inputFrequency = 0.43;
      const rate = 0.79;
      const outputFrequency = inputFrequency * rate;
      const source = createStereoSineSignal(4096, inputFrequency);

      const linear = transposeSignalInBlocks('linear', rate, source, 127);
      const lanczos = transposeSignalInBlocks('lanczos', rate, source, 127);

      const warmupFrames = 64;
      const linearFit = estimateSineResidualRmse(
        linear,
        outputFrequency,
        warmupFrames,
        0,
      );
      const lanczosFit = estimateSineResidualRmse(
        lanczos,
        outputFrequency,
        warmupFrames,
        0,
      );

      expect(lanczosFit.residualRmse).toBeLessThan(linearFit.residualRmse);

      const linearSnr =
        20 * Math.log10(linearFit.signalRmse / linearFit.residualRmse);
      const lanczosSnr =
        20 * Math.log10(lanczosFit.signalRmse / lanczosFit.residualRmse);

      expect(lanczosSnr).toBeGreaterThan(linearSnr + 1);
    });
  });

  describe('process', () => {
    it('returns early when buffers are not allocated', () => {
      const rt = new RateTransposer({ createBuffers: false });

      expect(() => rt.process()).not.toThrow();
    });

    it('returns early when the input buffer is empty', () => {
      const rt = new RateTransposer({ createBuffers: true });

      rt.process();

      expect(rt.outputBuffer!.frameCount).toBe(0);
    });

    it('moves data from input to output buffer', () => {
      const rt = new RateTransposer({ createBuffers: true });
      rt.rate = 1.0;

      const samples = new Float32Array(20);
      for (let i = 0; i < 20; i++) samples[i] = i * 0.1;
      rt.inputBuffer!.putSamples(samples);

      rt.process();
      expect(rt.outputBuffer!.frameCount).toBeGreaterThan(0);
      expect(rt.inputBuffer!.frameCount).toBe(0);
    });

    it('processes with the circular sample buffer adapter', () => {
      const rt = new RateTransposer({
        createBuffers: true,
        sampleBufferAdapterFactory: createCircularSampleBufferAdapter,
      });
      rt.rate = 1.0;

      const samples = new Float32Array(20);
      for (let i = 0; i < 20; i++) samples[i] = Math.sin(i * 0.2);
      rt.inputBuffer!.putSamples(samples);

      rt.process();
      expect(rt.outputBuffer!.frameCount).toBeGreaterThan(0);
      expect(rt.inputBuffer!.frameCount).toBe(0);
    });

    it('processes non-fifo input through adapter contract', () => {
      const rt = new RateTransposer({ createBuffers: false });
      rt.rate = 1.0;

      const input = new TestSampleBuffer(new Float32Array([1, 2, 3, 4, 5, 6]));
      rt.inputBuffer = input;
      rt.outputBuffer = new FifoSampleBuffer();

      rt.process();

      expect(input.frameCount).toBe(0);
      expect(rt.outputBuffer!.frameCount).toBeGreaterThan(0);
    });

    it('writes to non-fifo output through sample buffer contract', () => {
      const rt = new RateTransposer({ createBuffers: false });
      rt.rate = 1.0;

      const input = new FifoSampleBuffer();
      input.putSamples(new Float32Array([1, 2, 3, 4, 5, 6]));

      const output = new TestWritableSampleBuffer();
      rt.inputBuffer = input;
      rt.outputBuffer = output;

      rt.process();

      expect(rt.inputBuffer!.frameCount).toBe(0);
      expect(output.frameCount).toBeGreaterThan(0);
    });
  });
});
