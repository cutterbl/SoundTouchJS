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

/**
 * Floor for the per-sample overlap-add normalization divisor.
 *
 * @remarks
 * Wherever the accumulated window-squared sum is below this floor, the
 * numerator carries the same window factor (`O(w² · x)`), so dividing by the
 * floor attenuates rather than amplifies — no noise blow-up at frame edges.
 */
const OLA_NORM_EPS = 1e-6;

/** Valid FFT sizes for the phase vocoder. */
export type PhaseVocoderFftSize = 512 | 1024 | 2048 | 4096;

/** Valid overlap factors for the phase vocoder. */
export type PhaseVocoderOverlapFactor = 2 | 4 | 8;

/**
 * Construction options for `PhaseVocoder`.
 *
 * @remarks
 * `sampleRate`, `sampleBufferFactory`, and `sampleBufferType` are passed
 * through from `StretchFactoryOptions` when the vocoder is used as a
 * `StretchPipe` inside `SoundTouch`. They are not used internally by the
 * phase vocoder algorithm but are accepted for interface compatibility.
 */
export interface PhaseVocoderOptions {
  /** Ignored — accepted for constructor compatibility with the built-in Stretch stage. */
  sampleRate?: number;
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
 * 3. Run the phase-vocoder recursion once on the mid (L+R) spectrum — by FFT
 *    linearity it is the sum of the channel spectra, so no third FFT is
 *    needed — and resynthesize each channel as the shared mid synthesis phase
 *    plus that channel's instantaneous offset from the mid. This preserves
 *    the inter-channel phase difference exactly, keeping the stereo image
 *    (and center content) intact.
 * 4. Reconstruct with IFFT, apply Hann window, and overlap-add into an output buffer.
 * 5. Extract `Hs = round(Ha / tempo)` frames per processing step.
 *
 * Both analysis and synthesis are Hann-windowed (WOLA). Overlap-add is
 * normalized per sample by the accumulated sum of squared window values
 * (≈ 1.5 at 75 % overlap), which is exact for any synthesis hop — including
 * mid-stream tempo changes and hops large enough that windows no longer
 * overlap.
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

  // Per-channel analysis ring buffers (fftSize samples each).
  private analysisL: Float32Array;
  private analysisR: Float32Array;

  // FFT working arrays (fftSize each).
  private reL: Float32Array;
  private imL: Float32Array;
  private reR: Float32Array;
  private imR: Float32Array;

  // Phase vocoder state on the mid (L+R) reference (bins = fftSize/2 + 1).
  // A single shared recursion keeps the channels phase-coherent; values are
  // wrapped to (−π, π] so float32 storage never loses phase resolution.
  private prevPhaseM: Float32Array;
  private synthPhaseM: Float32Array;

  // Overlap-add accumulators (fftSize samples): windowed synthesis output
  // per channel, plus the squared-window sum used for exact normalization.
  private olaL: Float32Array;
  private olaR: Float32Array;
  private olaNorm: Float32Array;

  // Scratch buffers for deinterleaving / reinterleaving.
  private inputScratch: Float32Array;
  private outputScratch: Float32Array;

  /**
   * Hops remaining before the phase recursion may be seeded.
   *
   * @remarks
   * The sliding analysis window fills after `overlapFactor` hops. Seeding the
   * phase accumulators from a partially-filled (zero-padded) window freezes
   * the startup transient's arbitrary inter-bin phase relationships into the
   * recursion permanently — a constant level loss and envelope corruption at
   * every tempo ≠ 1. Frames pass through untouched until the window is
   * primed; the first fully-valid frame seeds the recursion.
   */
  private hopsUntilPrimed: number;

  /**
   * Creates a PhaseVocoder instance.
   * @param options Configuration options.
   */
  constructor(options: PhaseVocoderOptions = {}) {
    this.fftSize = options.fftSize ?? 2048;
    this.overlapFactor = options.overlapFactor ?? 4;
    this.analysisHop = this.fftSize / this.overlapFactor;
    this.window = makeHannWindow(this.fftSize);
    this.hopsUntilPrimed = this.overlapFactor;

    const N = this.fftSize;
    const bins = N / 2 + 1;
    const Ha = this.analysisHop;

    this.analysisL = new Float32Array(N);
    this.analysisR = new Float32Array(N);
    this.reL = new Float32Array(N);
    this.imL = new Float32Array(N);
    this.reR = new Float32Array(N);
    this.imR = new Float32Array(N);
    this.prevPhaseM = new Float32Array(bins);
    this.synthPhaseM = new Float32Array(bins);
    this.olaL = new Float32Array(N);
    this.olaR = new Float32Array(N);
    this.olaNorm = new Float32Array(N);
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
    this.olaNorm.fill(0);
    this.clearMidBuffer();
    // The analysis window was emptied, so it must refill before seeding.
    this.hopsUntilPrimed = this.overlapFactor;
  }

  /**
   * Resets only the phase accumulators without touching the sample buffers.
   *
   * @remarks
   * Call this when playback position changes (seeking) so the phase
   * continuity invariant is re-established on the next frame.
   */
  clearMidBuffer(): void {
    this.prevPhaseM.fill(0);
    this.synthPhaseM.fill(0);
    // The analysis window still holds valid samples; re-seed from the very
    // next frame rather than waiting for a full refill.
    this.hopsUntilPrimed = 1;
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

    // Window + FFT each channel, then run the shared phase-vocoder
    // recursion on the mid (L+R) reference and resynthesize both spectra.
    this._analyzeChannel(this.analysisL, this.reL, this.imL);
    this._analyzeChannel(this.analysisR, this.reR, this.imR);
    this._processSpectra(Ha, Hs, bins);

    ifft(this.reL, this.imL);
    ifft(this.reR, this.imR);

    // WOLA: overlap-add the synthesis-windowed frame, accumulating the
    // squared-window sum alongside for exact per-sample normalization.
    for (let i = 0; i < N; i++) {
      const wi = this.window[i];
      this.olaL[i] += this.reL[i] * wi;
      this.olaR[i] += this.reR[i] * wi;
      this.olaNorm[i] += wi * wi;
    }

    // Extraction-time normalization is complete for [0..toExtract): the next
    // frame's window lands at post-shift positions, so no future frame can
    // contribute to the samples extracted here.
    const toExtract = Math.min(Hs, N);
    for (let i = 0; i < toExtract; i++) {
      const norm = 1.0 / Math.max(this.olaNorm[i], OLA_NORM_EPS);
      this.outputScratch[i * 2] = this.olaL[i] * norm;
      this.outputScratch[i * 2 + 1] = this.olaR[i] * norm;
    }
    this.outputBuffer.putSamples(this.outputScratch, 0, toExtract);

    // Shift OLA buffers left by the extracted amount, zero the tails.
    this.olaL.copyWithin(0, toExtract);
    this.olaR.copyWithin(0, toExtract);
    this.olaNorm.copyWithin(0, toExtract);
    this.olaL.fill(0, N - toExtract);
    this.olaR.fill(0, N - toExtract);
    this.olaNorm.fill(0, N - toExtract);
  }

  /**
   * Applies the analysis window and computes the forward FFT of one channel.
   *
   * @param analysis fftSize-sample sliding analysis window.
   * @param re FFT real working buffer (modified in-place).
   * @param im FFT imaginary working buffer (modified in-place).
   */
  private _analyzeChannel(
    analysis: Float32Array,
    re: Float32Array,
    im: Float32Array,
  ): void {
    const N = this.fftSize;
    const w = this.window;

    for (let i = 0; i < N; i++) {
      re[i] = analysis[i] * w[i];
      im[i] = 0.0;
    }

    fft(re, im);
  }

  /**
   * Runs the phase-vocoder recursion on the mid (L+R) reference and
   * resynthesizes both channel spectra in-place.
   *
   * @remarks
   * The recursion (instantaneous-frequency estimate and synthesis-phase
   * accumulation) is computed once per bin on the mid spectrum — by FFT
   * linearity, `specL + specR` — and each channel's synthesis phase is the
   * shared mid phase plus that channel's instantaneous offset from the mid:
   * `synthC = synthM + (phaseC − phaseM)`. The inter-channel difference is
   * therefore preserved exactly (`synthL − synthR = phaseL − phaseR`), so
   * identical channels stay bit-identical and the stereo image is intact.
   *
   * For bins where the mid spectrum nearly vanishes (anti-phase content) the
   * reference phase is noisy; the inter-channel difference is still exact and
   * the worst case is temporal smearing on those bins only.
   *
   * @param Ha Analysis hop size.
   * @param Hs Synthesis hop size.
   * @param bins Number of positive-frequency bins (fftSize/2 + 1).
   */
  private _processSpectra(Ha: number, Hs: number, bins: number): void {
    const N = this.fftSize;
    const reL = this.reL;
    const imL = this.imL;
    const reR = this.reR;
    const imR = this.imR;
    const twoPi = 2.0 * Math.PI;
    const twoPiOverN = twoPi / N;

    if (this.hopsUntilPrimed > 0) {
      // Pre-primed hops: (re-)seed the mid phase state and leave both
      // spectra untouched so the IFFT reproduces the windowed input (the FFT
      // of a real signal is already conjugate-symmetric — no fill needed).
      // Seeding repeats each hop until the analysis window is full, so the
      // recursion starts from the first fully-valid frame's structure rather
      // than freezing the startup transient into the accumulators.
      for (let k = 0; k < bins; k++) {
        const phaseM = Math.atan2(imL[k] + imR[k], reL[k] + reR[k]);
        this.prevPhaseM[k] = phaseM;
        this.synthPhaseM[k] = phaseM;
      }
      this.hopsUntilPrimed--;
      return;
    }

    for (let k = 0; k < bins; k++) {
      const phaseM = Math.atan2(imL[k] + imR[k], reL[k] + reR[k]);

      // Instantaneous phase deviation from expected advance, on the mid.
      const expectedAdvance = k * twoPiOverN * Ha;
      let delta = phaseM - this.prevPhaseM[k] - expectedAdvance;

      // Wrap to (−π, π].
      delta -= twoPi * Math.round(delta / twoPi);

      // Accumulate synthesis phase scaled by the time-stretch ratio, wrapping
      // so the float32 accumulator never loses phase resolution.
      const trueFreq = k * twoPiOverN + delta / Ha;
      let synthM = this.synthPhaseM[k] + trueFreq * Hs;
      synthM -= twoPi * Math.round(synthM / twoPi);
      this.synthPhaseM[k] = synthM;
      this.prevPhaseM[k] = phaseM;

      // Resynthesize each channel: keep its magnitude, use the shared mid
      // synthesis phase plus the channel's offset from the mid. Offsets are
      // differences of atan2 results, bounded in (−2π, 2π) — safe for cos/sin.
      const magL = Math.sqrt(reL[k] * reL[k] + imL[k] * imL[k]);
      const phL = synthM + (Math.atan2(imL[k], reL[k]) - phaseM);
      reL[k] = magL * Math.cos(phL);
      imL[k] = magL * Math.sin(phL);

      const magR = Math.sqrt(reR[k] * reR[k] + imR[k] * imR[k]);
      const phR = synthM + (Math.atan2(imR[k], reR[k]) - phaseM);
      reR[k] = magR * Math.cos(phR);
      imR[k] = magR * Math.sin(phR);
    }

    // Fill conjugate-symmetric bins for real output, both channels.
    for (let k = bins; k < N; k++) {
      const mirror = N - k;
      reL[k] = reL[mirror];
      imL[k] = -imL[mirror];
      reR[k] = reR[mirror];
      imR[k] = -imR[mirror];
    }
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
  return (sampleRate, opts) =>
    new PhaseVocoder({ sampleRate, fftSize, overlapFactor, ...opts });
}
