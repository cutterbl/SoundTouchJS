/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
  SampleBuffer,
  SampleBufferType,
  StretchFactory,
  StretchParameters,
  StretchPipe,
} from '@soundtouchjs/core';
import { fft, ifft } from './fft.js';
import { makeHannWindow } from './windows.js';

/** Valid FFT sizes for the phase vocoder. */
export type PhaseVocoderFftSize = 512 | 1024 | 2048 | 4096;

/** Valid overlap factors for the phase vocoder. */
export type PhaseVocoderOverlapFactor = 2 | 4 | 8;

/**
 * Construction options for `PhaseVocoder`.
 *
 * @remarks
 * `sampleBufferFactory` and `sampleBufferType` are passed through from
 * `StretchFactoryOptions` when the vocoder is used as a `StretchPipe` inside
 * `SoundTouch`. They are not used internally by the phase vocoder algorithm
 * but are accepted for interface compatibility.
 */
export interface PhaseVocoderOptions {
  /** FFT frame size. Must be a power of two. @defaultValue 2048 */
  fftSize?: PhaseVocoderFftSize;
  /**
   * Overlap factor — determines the analysis hop size as `fftSize / overlapFactor`.
   * Higher values give smoother output at the cost of more computation.
   * @defaultValue 4
   */
  overlapFactor?: PhaseVocoderOverlapFactor;
  /** Ignored — accepted for StretchPipe factory compatibility. */
  sampleBufferFactory?: () => SampleBuffer;
  /** Ignored — accepted for StretchPipe factory compatibility. */
  sampleBufferType?: SampleBufferType;
}

/**
 * FFT-based phase vocoder that implements the `StretchPipe` interface.
 *
 * @remarks
 * Provides high-quality time-stretching via phase accumulation and
 * overlap-add reconstruction. Operates on interleaved stereo frames
 * (L, R, L, R, …) matching the SoundTouch pipeline format.
 *
 * Use as a drop-in replacement for the WSOLA `Stretch` stage by passing
 * a {@link createPhaseVocoderFactory} result to `SoundTouchOptions.stretchFactory`.
 *
 * **Algorithm overview:**
 * 1. Accumulate analysis frames into a sliding `fftSize`-sample window.
 * 2. Apply a Hann window and compute the FFT of each channel.
 * 3. Compute instantaneous frequency per bin and accumulate synthesis phase.
 * 4. Reconstruct with IFFT, apply Hann window, and overlap-add into an output buffer.
 * 5. Extract `Hs = round(Ha / tempo)` frames per processing step.
 *
 * The normalization factor is `overlapFactor / 2` (for a Hann window, four
 * 75 %-overlapping windows sum to 2; factor-2 windows sum to 1).
 *
 * @example
 * import { SoundTouch } from '@soundtouchjs/core';
 * import { createPhaseVocoderFactory } from '@soundtouchjs/stretch-phase-vocoder';
 *
 * const st = new SoundTouch({ stretchFactory: createPhaseVocoderFactory() });
 */
export class PhaseVocoder implements StretchPipe {
  /** @inheritdoc */
  inputBuffer: SampleBuffer | null = null;
  /** @inheritdoc */
  outputBuffer: SampleBuffer | null = null;

  private _tempo = 1.0;

  private readonly fftSize: number;
  private readonly overlapFactor: number;
  private readonly analysisHop: number;
  private readonly window: Float32Array;
  /** Reciprocal of the OLA normalization constant (overlapFactor / 2). */
  private readonly normInv: number;

  // Per-channel analysis ring buffers (fftSize samples each).
  private analysisL: Float32Array;
  private analysisR: Float32Array;

  // FFT working arrays (fftSize each).
  private reL: Float32Array;
  private imL: Float32Array;
  private reR: Float32Array;
  private imR: Float32Array;

  // Phase vocoder state (bins = fftSize/2 + 1).
  private prevPhaseL: Float32Array;
  private prevPhaseR: Float32Array;
  private synthPhaseL: Float32Array;
  private synthPhaseR: Float32Array;

  // Overlap-add accumulator (fftSize samples).
  private olaL: Float32Array;
  private olaR: Float32Array;

  // Scratch buffers for deinterleaving / reinterleaving.
  private inputScratch: Float32Array;
  private outputScratch: Float32Array;

  /** Whether the phase accumulators hold valid state from a previous frame. */
  private hasFrame = false;

  /**
   * Creates a PhaseVocoder instance.
   * @param options Configuration options.
   */
  constructor(options: PhaseVocoderOptions = {}) {
    this.fftSize = options.fftSize ?? 2048;
    this.overlapFactor = options.overlapFactor ?? 4;
    this.analysisHop = this.fftSize / this.overlapFactor;
    this.window = makeHannWindow(this.fftSize);
    // For Hann OLA with overlapFactor, sum of windows = overlapFactor / 2
    this.normInv = 2.0 / this.overlapFactor;

    const N = this.fftSize;
    const bins = N / 2 + 1;
    const Ha = this.analysisHop;

    this.analysisL = new Float32Array(N);
    this.analysisR = new Float32Array(N);
    this.reL = new Float32Array(N);
    this.imL = new Float32Array(N);
    this.reR = new Float32Array(N);
    this.imR = new Float32Array(N);
    this.prevPhaseL = new Float32Array(bins);
    this.prevPhaseR = new Float32Array(bins);
    this.synthPhaseL = new Float32Array(bins);
    this.synthPhaseR = new Float32Array(bins);
    this.olaL = new Float32Array(N);
    this.olaR = new Float32Array(N);
    this.inputScratch = new Float32Array(Ha * 2);
    this.outputScratch = new Float32Array(N * 2);
  }

  /**
   * Tempo multiplier for time-stretching (1.0 = original speed).
   *
   * @remarks
   * Matches the convention of the WSOLA `Stretch` stage: values greater than 1
   * speed up playback (shorter output) and values less than 1 slow it down
   * (longer output). The synthesis hop is derived as `round(Ha / tempo)`.
   */
  get tempo(): number {
    return this._tempo;
  }

  set tempo(t: number) {
    this._tempo = t;
  }

  /**
   * Minimum number of input frames required before `process()` can run.
   *
   * @remarks
   * Equal to the analysis hop size `fftSize / overlapFactor`.
   */
  get sampleReq(): number {
    return this.analysisHop;
  }

  /**
   * Resets all internal state including the analysis window and OLA buffer.
   */
  clear(): void {
    this.analysisL.fill(0);
    this.analysisR.fill(0);
    this.olaL.fill(0);
    this.olaR.fill(0);
    this.clearMidBuffer();
  }

  /**
   * Resets only the phase accumulators without touching the sample buffers.
   *
   * @remarks
   * Call this when playback position changes (seeking) so the phase
   * continuity invariant is re-established on the next frame.
   */
  clearMidBuffer(): void {
    this.prevPhaseL.fill(0);
    this.prevPhaseR.fill(0);
    this.synthPhaseL.fill(0);
    this.synthPhaseR.fill(0);
    this.hasFrame = false;
  }

  /**
   * Configures the processing parameters.
   *
   * @remarks
   * The phase vocoder algorithm is sample-rate independent; `sampleRate` and
   * WSOLA-specific timing parameters are accepted for interface compatibility
   * but have no effect on output.
   *
   * @param _sampleRate Ignored.
   * @param _sequenceMs Ignored.
   * @param _seekWindowMs Ignored.
   * @param _overlapMs Ignored.
   */
  setParameters(
    _sampleRate: number,
    _sequenceMs: number,
    _seekWindowMs: number,
    _overlapMs: number,
  ): void {
    // Phase vocoder timing is controlled by fftSize and overlapFactor.
  }

  /**
   * Accepts WSOLA timing parameter updates for interface compatibility.
   *
   * @remarks
   * The phase vocoder does not expose WSOLA-style timing parameters; this
   * method is a no-op and exists to satisfy the `StretchPipe` interface.
   *
   * @param _params Ignored.
   */
  setStretchParameters(_params: StretchParameters): void {
    // No WSOLA parameters to apply.
  }

  /**
   * Creates an independent copy with the same FFT size and overlap factor.
   *
   * @remarks
   * The clone starts with empty buffers and no phase history — equivalent to
   * constructing a new instance with the same options.
   *
   * @returns A new `PhaseVocoder` instance.
   */
  clone(): PhaseVocoder {
    const c = new PhaseVocoder({
      fftSize: this.fftSize as PhaseVocoderFftSize,
      overlapFactor: this.overlapFactor as PhaseVocoderOverlapFactor,
    });
    c.tempo = this._tempo;
    return c;
  }

  /**
   * Processes one analysis hop from `inputBuffer` and writes the synthesis
   * result to `outputBuffer`.
   *
   * @remarks
   * Reads exactly `sampleReq` frames from `inputBuffer` and produces
   * `round(sampleReq / tempo)` frames into `outputBuffer`. Does nothing if
   * either buffer is unset or if `inputBuffer` contains fewer than `sampleReq`
   * frames.
   */
  process(): void {
    if (!this.inputBuffer || !this.outputBuffer) return;
    const Ha = this.analysisHop;
    if (this.inputBuffer.frameCount < Ha) return;

    const N = this.fftSize;
    const bins = N / 2 + 1;
    const Hs = Math.max(1, Math.round(Ha / this._tempo));

    // Ensure scratch buffers are large enough.
    if (this.inputScratch.length < Ha * 2) {
      this.inputScratch = new Float32Array(Ha * 2);
    }
    if (this.outputScratch.length < Hs * 2) {
      this.outputScratch = new Float32Array(Hs * 2);
    }

    // Consume Ha frames from inputBuffer.
    this.inputBuffer.extract(this.inputScratch, 0, Ha);
    this.inputBuffer.receive(Ha);

    // Slide analysis window: discard oldest Ha frames, append new ones.
    this.analysisL.copyWithin(0, Ha);
    this.analysisR.copyWithin(0, Ha);
    for (let i = 0; i < Ha; i++) {
      this.analysisL[N - Ha + i] = this.inputScratch[i * 2];
      this.analysisR[N - Ha + i] = this.inputScratch[i * 2 + 1];
    }

    // Process each channel independently.
    this._processChannel(
      this.analysisL,
      this.reL,
      this.imL,
      this.prevPhaseL,
      this.synthPhaseL,
      Ha,
      Hs,
      bins,
    );
    this._processChannel(
      this.analysisR,
      this.reR,
      this.imR,
      this.prevPhaseR,
      this.synthPhaseR,
      Ha,
      Hs,
      bins,
    );

    this.hasFrame = true;

    // Overlap-add: accumulate synthesis frame then extract Hs frames.
    const norm = this.normInv;
    for (let i = 0; i < N; i++) {
      this.olaL[i] += this.reL[i] * this.window[i] * norm;
      this.olaR[i] += this.reR[i] * this.window[i] * norm;
    }

    const toExtract = Math.min(Hs, N);
    for (let i = 0; i < toExtract; i++) {
      this.outputScratch[i * 2] = this.olaL[i];
      this.outputScratch[i * 2 + 1] = this.olaR[i];
    }
    this.outputBuffer.putSamples(this.outputScratch, 0, toExtract);

    // Shift OLA buffer left by Hs, zero the tail.
    this.olaL.copyWithin(0, toExtract);
    this.olaR.copyWithin(0, toExtract);
    this.olaL.fill(0, N - toExtract);
    this.olaR.fill(0, N - toExtract);
  }

  /**
   * Runs one FFT frame through the phase vocoder for a single channel.
   *
   * @remarks
   * Reads from `analysis`, writes synthesized real output back into `re` (the
   * imaginary output is discarded). Updates `prevPhase` and `synthPhase` in-place.
   *
   * @param analysis fftSize-sample sliding analysis window.
   * @param re FFT real working buffer (modified in-place).
   * @param im FFT imaginary working buffer (modified in-place).
   * @param prevPhase Previous-frame phase per bin (modified in-place).
   * @param synthPhase Accumulated synthesis phase per bin (modified in-place).
   * @param Ha Analysis hop size.
   * @param Hs Synthesis hop size.
   * @param bins Number of positive-frequency bins (fftSize/2 + 1).
   */
  private _processChannel(
    analysis: Float32Array,
    re: Float32Array,
    im: Float32Array,
    prevPhase: Float32Array,
    synthPhase: Float32Array,
    Ha: number,
    Hs: number,
    bins: number,
  ): void {
    const N = this.fftSize;
    const w = this.window;

    // Apply analysis window.
    for (let i = 0; i < N; i++) {
      re[i] = analysis[i] * w[i];
      im[i] = 0.0;
    }

    fft(re, im);

    // Phase accumulation (positive-frequency bins only).
    const twoPiOverN = (2.0 * Math.PI) / N;
    if (!this.hasFrame) {
      // First frame: seed phases from analysis, no output correction.
      for (let k = 0; k < bins; k++) {
        const phase = Math.atan2(im[k], re[k]);
        prevPhase[k] = phase;
        synthPhase[k] = phase;
      }
    } else {
      for (let k = 0; k < bins; k++) {
        const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        const phase = Math.atan2(im[k], re[k]);

        // Instantaneous phase deviation from expected advance.
        const expectedAdvance = k * twoPiOverN * Ha;
        let delta = phase - prevPhase[k] - expectedAdvance;

        // Wrap to (−π, π].
        delta -= 2.0 * Math.PI * Math.round(delta / (2.0 * Math.PI));

        // Accumulate synthesis phase scaled by the time-stretch ratio.
        const trueFreq = k * twoPiOverN + delta / Ha;
        synthPhase[k] += trueFreq * Hs;
        prevPhase[k] = phase;

        // Resynthesize: keep magnitude, use accumulated phase.
        re[k] = mag * Math.cos(synthPhase[k]);
        im[k] = mag * Math.sin(synthPhase[k]);
      }

      // Fill conjugate-symmetric bins for real output.
      for (let k = bins; k < N; k++) {
        const mirror = N - k;
        re[k] = re[mirror];
        im[k] = -im[mirror];
      }
    }

    ifft(re, im);
    // Imaginary part is discarded; re holds the real synthesis output.
  }
}

/**
 * Creates a `StretchFactory` that produces `PhaseVocoder` instances.
 *
 * @remarks
 * Pass the returned factory to `SoundTouchOptions.stretchFactory` to use the
 * phase vocoder as the time-stretch stage inside `SoundTouch`.
 *
 * @param fftSize FFT frame size. @defaultValue 2048
 * @param overlapFactor Overlap factor. @defaultValue 4
 * @returns A `StretchFactory` bound to the given FFT parameters.
 *
 * @example
 * import { SoundTouch } from '@soundtouchjs/core';
 * import { createPhaseVocoderFactory } from '@soundtouchjs/stretch-phase-vocoder';
 *
 * const st = new SoundTouch({ stretchFactory: createPhaseVocoderFactory(1024, 4) });
 */
export function createPhaseVocoderFactory(
  fftSize: PhaseVocoderFftSize = 2048,
  overlapFactor: PhaseVocoderOverlapFactor = 4,
): StretchFactory {
  return (_sampleRate, opts) =>
    new PhaseVocoder({ fftSize, overlapFactor, ...opts });
}
