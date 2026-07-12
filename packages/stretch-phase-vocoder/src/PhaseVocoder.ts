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
 * 3. Run the phase-vocoder recursion at spectral peaks of the mid (L+R)
 *    spectrum — by FFT linearity the sum of the channel spectra, so no third
 *    FFT is needed — and rotate each peak's region of influence rigidly by
 *    the peak's synthesis rotation (identity phase locking). Rigid rotation
 *    preserves both the local phase structure (broadband/noise content stays
 *    coherent under overlap-add) and the inter-channel phase difference
 *    (stereo image and center content stay intact).
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
  // The recursion runs only at spectral peaks (identity phase locking); each
  // peak's region rotates rigidly, so phases are carried as complex spectra —
  // inherently wrapped, no unbounded accumulators. prevMid holds the previous
  // analysis mid spectrum, synthMid the previous synthesized mid spectrum.
  private prevMidRe: Float32Array;
  private prevMidIm: Float32Array;
  private synthMidRe: Float32Array;
  private synthMidIm: Float32Array;

  // Per-frame scratch: current mid spectrum, its magnitudes, and peak indices.
  private midRe: Float32Array;
  private midIm: Float32Array;
  private midMag: Float32Array;
  private peaks: Int32Array;

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
    this.prevMidRe = new Float32Array(bins);
    this.prevMidIm = new Float32Array(bins);
    this.synthMidRe = new Float32Array(bins);
    this.synthMidIm = new Float32Array(bins);
    this.midRe = new Float32Array(bins);
    this.midIm = new Float32Array(bins);
    this.midMag = new Float32Array(bins);
    this.peaks = new Int32Array(bins);
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
    this.prevMidRe.fill(0);
    this.prevMidIm.fill(0);
    this.synthMidRe.fill(0);
    this.synthMidIm.fill(0);
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
   * Runs the peak-locked phase-vocoder recursion on the mid (L+R) reference
   * and resynthesizes both channel spectra in-place.
   *
   * @remarks
   * Identity phase locking (Puckette 1995; Laroche & Dolson 1999): the
   * instantaneous-frequency recursion runs only at spectral peaks of the mid
   * magnitude — by FFT linearity the mid spectrum is `specL + specR`, so no
   * third FFT is needed — and every bin in a peak's region of influence
   * rotates rigidly by that peak's synthesis rotation. Rigid rotation
   * preserves the analysis frame's local phase structure, which keeps
   * overlap-added frames coherent for noise-like content too (a per-bin
   * recursion re-randomizes those relationships once `Hs ≠ Ha`, costing
   * ~3 dB of broadband level).
   *
   * Both channels rotate by the same angle per bin, so the inter-channel
   * phase difference is preserved exactly — identical channels stay
   * bit-identical and the stereo image is intact.
   *
   * Phase state is carried as complex spectra (previous analysis mid and
   * previous synthesized mid); complex storage is inherently wrapped, so
   * there is no unbounded phase accumulator by construction.
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
    const midRe = this.midRe;
    const midIm = this.midIm;
    const midMag = this.midMag;
    const twoPi = 2.0 * Math.PI;
    const twoPiOverN = twoPi / N;

    for (let k = 0; k < bins; k++) {
      midRe[k] = reL[k] + reR[k];
      midIm[k] = imL[k] + imR[k];
      midMag[k] = Math.sqrt(midRe[k] * midRe[k] + midIm[k] * midIm[k]);
    }

    if (this.hopsUntilPrimed > 0) {
      // Pre-primed hops: (re-)seed the phase state and leave both spectra
      // untouched so the IFFT reproduces the windowed input (the FFT of a
      // real signal is already conjugate-symmetric — no fill needed).
      // Seeding repeats each hop until the analysis window is full, so the
      // recursion starts from the first fully-valid frame's structure rather
      // than freezing the startup transient into the phase state.
      this.prevMidRe.set(midRe);
      this.prevMidIm.set(midIm);
      this.synthMidRe.set(midRe);
      this.synthMidIm.set(midIm);
      this.hopsUntilPrimed--;
      return;
    }

    // Find local maxima of the mid magnitude (plateau-tolerant). Silence
    // degenerates to every bin being a "peak" with a zero rotation — harmless.
    const peaks = this.peaks;
    let peakCount = 0;
    for (let k = 0; k < bins; k++) {
      const left = k > 0 ? midMag[k - 1] : -1;
      const right = k < bins - 1 ? midMag[k + 1] : -1;
      if (midMag[k] >= left && midMag[k] >= right) {
        peaks[peakCount++] = k;
      }
    }

    // Process each peak's region of influence: [regionStart, regionEnd).
    // Boundaries sit at the midpoint between adjacent peaks.
    let regionStart = 0;
    for (let p = 0; p < peakCount; p++) {
      const k = peaks[p];
      const regionEnd = p + 1 < peakCount ? (k + peaks[p + 1] + 1) >> 1 : bins;

      // Phase-vocoder recursion at the peak bin. Phase differences come from
      // complex products against the stored previous spectra, so only the
      // peak bins ever need atan2/cos/sin.
      const phaseCur = Math.atan2(midIm[k], midRe[k]);
      // arg(cur · conj(prev)) = phaseCur − phasePrev, already in (−π, π].
      const phaseDiff = Math.atan2(
        midIm[k] * this.prevMidRe[k] - midRe[k] * this.prevMidIm[k],
        midRe[k] * this.prevMidRe[k] + midIm[k] * this.prevMidIm[k],
      );

      const expectedAdvance = k * twoPiOverN * Ha;
      let delta = phaseDiff - expectedAdvance;
      delta -= twoPi * Math.round(delta / twoPi); // wrap to (−π, π]

      const trueFreq = k * twoPiOverN + delta / Ha;
      const synthPrev = Math.atan2(this.synthMidIm[k], this.synthMidRe[k]);

      // Rigid rotation for this peak's whole region: the peak's accumulated
      // synthesis phase advance relative to its current analysis phase.
      const theta = synthPrev + trueFreq * Hs - phaseCur;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      for (let j = regionStart; j < regionEnd; j++) {
        // Store the synthesized mid for the next frame's recursion.
        this.synthMidRe[j] = midRe[j] * cosT - midIm[j] * sinT;
        this.synthMidIm[j] = midRe[j] * sinT + midIm[j] * cosT;

        const rl = reL[j];
        const il = imL[j];
        reL[j] = rl * cosT - il * sinT;
        imL[j] = rl * sinT + il * cosT;

        const rr = reR[j];
        const ir = imR[j];
        reR[j] = rr * cosT - ir * sinT;
        imR[j] = rr * sinT + ir * cosT;
      }

      regionStart = regionEnd;
    }

    this.prevMidRe.set(midRe);
    this.prevMidIm.set(midIm);

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
