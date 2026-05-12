/*
 * SoundTouch JS audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 * Copyright (c) Jakub Fiala
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

import AbstractSamplePipe from './AbstractSamplePipe.js';
import CircularSampleBuffer from './CircularSampleBuffer.js';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import type { SampleBuffer } from './SampleBuffer.js';
import type { StretchPipe } from './StretchPipe.js';

/**
 * Read adapter used by `Stretch` so input access is decoupled from concrete
 * buffer implementations.
 */
interface StretchReadBufferAdapter {
  /** Number of readable frames currently exposed by the adapter. */
  readonly frameCount: number;
  /** Sample-index origin used by callers that operate on absolute offsets. */
  readonly startIndex: number;

  /**
   * Binds the adapter to a new source buffer.
   * @param buffer Source buffer to read from.
   */
  setBuffer(buffer: SampleBuffer): void;

  /**
   * Reads a single sample at an absolute sample index.
   * @param sampleIndex Absolute sample index.
   */
  readSample(sampleIndex: number): number;

  /**
   * Returns a contiguous sample range.
   * @param start Inclusive start sample index.
   * @param end Exclusive end sample index.
   */
  readSubarray(start: number, end: number): Float32Array;

  /**
   * Consumes frames from the adapter source.
   * @param numFrames Number of frames to consume.
   */
  receive(numFrames: number): void;

  /**
   * Extracts and consumes frames into `output`.
   * @param output Destination sample array.
   * @param numFrames Number of frames to extract.
   */
  receiveSamples(output: Float32Array, numFrames: number): void;
}

/**
 * Write adapter used by `Stretch` so output appends are abstracted over the
 * target buffer implementation.
 */
interface StretchWriteBufferAdapter {
  /**
   * Binds adapter writes to the provided output buffer.
   * @param buffer Destination buffer.
   */
  setOutputBuffer(buffer: SampleBuffer): void;

  /**
   * Appends raw interleaved stereo frames.
   * @param samples Interleaved stereo source samples.
   * @param numFrames Number of frames to append.
   */
  appendSamples(samples: Float32Array, numFrames: number): void;

  /**
   * Copies frames from a read adapter into the bound output.
   * @param source Source adapter.
   * @param position Source frame offset.
   * @param numFrames Number of frames to copy.
   */
  putFrom(
    source: StretchReadBufferAdapter,
    position: number,
    numFrames: number,
  ): void;
}

/** Factory for stretch input adapters. */
type StretchInputBufferAdapterFactory = () => StretchReadBufferAdapter;

/**
 * WSOLA timing parameters that control the time-stretching algorithm.
 *
 * @remarks
 * All time-based fields are in milliseconds. Pass `0` for `sequenceMs` or
 * `seekWindowMs` to let the algorithm auto-compute values based on tempo.
 * Omit a field to leave it unchanged.
 *
 * @example
 * stretch.setStretchParameters({ overlapMs: 12, quickSeek: false });
 */
export interface StretchParameters {
  /**
   * Length of the processing sequence window in milliseconds.
   * `0` switches to automatic calculation (50–125 ms range based on tempo).
   */
  sequenceMs?: number;

  /**
   * Length of the seek window in milliseconds.
   * `0` switches to automatic calculation (15–25 ms range based on tempo).
   */
  seekWindowMs?: number;

  /**
   * Overlap crossfade length in milliseconds.
   * Must be greater than `0`. Values less than `1 ms` (after sample-rate conversion) are clamped to 16 samples.
   */
  overlapMs?: number;

  /**
   * Whether to use the fast multi-pass seek algorithm.
   * `true` (default) uses a quick scan; `false` performs an exhaustive search for better quality at lower tempos.
   */
  quickSeek?: boolean;
}

export interface StretchConstructorOptions {
  /** Whether to allocate internal input/output buffers. */
  createBuffers?: boolean;
  /** Factory for creating stretch input adapters. */
  inputBufferAdapterFactory?: StretchInputBufferAdapterFactory;
  /** Factory for creating chain input/output buffers. */
  sampleBufferFactory?: () => SampleBuffer;
}

/**
 * Read adapter optimized for FIFO-backed buffers with a generic fallback path.
 */
class FifoStretchBufferAdapter implements StretchReadBufferAdapter {
  private buffer: FifoSampleBuffer | null;
  private readonly fallbackBuffer: FifoSampleBuffer;
  private fallbackScratch: Float32Array;

  constructor() {
    this.buffer = null;
    this.fallbackBuffer = new FifoSampleBuffer();
    this.fallbackScratch = new Float32Array(0);
  }

  /**
   * @param buffer Source buffer to expose through FIFO-style reads.
   */
  setBuffer(buffer: SampleBuffer): void {
    if (buffer instanceof FifoSampleBuffer) {
      this.buffer = buffer;
      return;
    }

    const frameCount = buffer.frameCount;
    if (frameCount > 0) {
      const sampleCount = frameCount * 2;
      if (this.fallbackScratch.length < sampleCount) {
        this.fallbackScratch = new Float32Array(sampleCount);
      }
      buffer.extract(this.fallbackScratch, 0, frameCount);
      this.fallbackBuffer.clear();
      this.fallbackBuffer.putSamples(this.fallbackScratch, 0, frameCount);
      buffer.receive(frameCount);
    } else {
      this.fallbackBuffer.clear();
    }

    this.buffer = this.fallbackBuffer;
  }

  /**
   * Returns the currently bound FIFO buffer.
   * @throws Error when `setBuffer` has not been called yet.
   */
  private getBoundBuffer(): FifoSampleBuffer {
    if (this.buffer === null) {
      throw new Error('buffer is not set');
    }
    return this.buffer;
  }

  get frameCount(): number {
    return this.getBoundBuffer().frameCount;
  }

  get startIndex(): number {
    return this.getBoundBuffer().startIndex;
  }

  readSample(sampleIndex: number): number {
    const boundBuffer = this.getBoundBuffer();
    const start = boundBuffer.startIndex;
    const end = start + boundBuffer.frameCount * 2;
    if (sampleIndex < start || sampleIndex >= end) {
      return 0;
    }
    return boundBuffer.vector[sampleIndex];
  }

  readSubarray(start: number, end: number): Float32Array {
    return this.getBoundBuffer().vector.subarray(start, end);
  }

  receive(numFrames: number): void {
    this.getBoundBuffer().receive(numFrames);
  }

  receiveSamples(output: Float32Array, numFrames: number): void {
    this.getBoundBuffer().receiveSamples(output, numFrames);
  }
}

class GenericStretchWriteBufferAdapter implements StretchWriteBufferAdapter {
  private buffer: SampleBuffer | null;

  constructor() {
    this.buffer = null;
  }

  setOutputBuffer(buffer: SampleBuffer): void {
    this.buffer = buffer;
  }

  /**
   * Returns the currently bound output buffer.
   * @throws Error when `setOutputBuffer` has not been called.
   */
  private getBoundBuffer(): SampleBuffer {
    if (this.buffer === null) {
      throw new Error('output buffer is not set');
    }
    return this.buffer;
  }

  appendSamples(samples: Float32Array, numFrames: number): void {
    this.getBoundBuffer().putSamples(samples, 0, numFrames);
  }

  putFrom(
    source: StretchReadBufferAdapter,
    position: number,
    numFrames: number,
  ): void {
    const sourceStart = source.startIndex + position * 2;
    const sourceEnd = sourceStart + numFrames * 2;
    const chunk = source.readSubarray(sourceStart, sourceEnd);
    this.getBoundBuffer().putSamples(chunk, 0, numFrames);
  }
}

class CircularStretchInputBufferAdapter implements StretchReadBufferAdapter {
  private readonly circularBuffer: CircularSampleBuffer;
  private rangeScratch: Float32Array;

  constructor() {
    this.circularBuffer = new CircularSampleBuffer();
    this.rangeScratch = new Float32Array(0);
  }

  /**
   * Binds a source buffer and stages its readable frames into the internal
   * circular storage.
   *
   * @param buffer Source buffer to import.
   */
  setBuffer(buffer: SampleBuffer): void {
    if (buffer instanceof FifoSampleBuffer) {
      const frames = buffer.frameCount;
      if (frames > 0) {
        this.circularBuffer.pushSamples(buffer.vector, buffer.position, frames);
        buffer.receive(frames);
      }
      return;
    }

    const frames = buffer.frameCount;
    if (frames > 0) {
      const sampleCount = frames * 2;
      if (this.rangeScratch.length < sampleCount) {
        this.rangeScratch = new Float32Array(sampleCount);
      }
      buffer.extract(this.rangeScratch, 0, frames);
      this.circularBuffer.pushSamples(this.rangeScratch, 0, frames);
      buffer.receive(frames);
    }
  }

  get frameCount(): number {
    return this.circularBuffer.frameCount;
  }

  get startIndex(): number {
    return 0;
  }

  readSample(sampleIndex: number): number {
    return this.circularBuffer.readSample(sampleIndex);
  }

  /**
   * Returns a contiguous range from circular storage, padding trailing values
   * with zeros when the requested range extends past available data.
   */
  readSubarray(start: number, end: number): Float32Array {
    const normalizedStart = Math.max(0, Math.floor(start));
    const normalizedEnd = Math.max(normalizedStart, Math.floor(end));
    const requestedSamples = normalizedEnd - normalizedStart;
    const requestedFrames = Math.floor(requestedSamples / 2);

    if (requestedFrames <= 0) {
      return this.rangeScratch.subarray(0, 0);
    }

    const needed = requestedFrames * 2;
    if (this.rangeScratch.length < needed) {
      this.rangeScratch = new Float32Array(needed);
    }

    const sourceFrameOffset = Math.floor(normalizedStart / 2);
    const readFrames = this.circularBuffer.extract(
      this.rangeScratch,
      sourceFrameOffset,
      requestedFrames,
      false,
    );

    const readSamples = readFrames * 2;
    if (readSamples < needed) {
      this.rangeScratch.fill(0, readSamples, needed);
    }

    return this.rangeScratch.subarray(0, needed);
  }

  receive(numFrames: number): void {
    this.circularBuffer.dropFrames(numFrames);
  }

  receiveSamples(output: Float32Array, numFrames: number): void {
    this.circularBuffer.extract(output, 0, numFrames, true);
  }
}

/**
 * Creates a stretch input adapter that reads from FIFO-compatible buffers.
 */
export const createFifoStretchInputBufferAdapter: StretchInputBufferAdapterFactory =
  () => new FifoStretchBufferAdapter();

/**
 * Creates a stretch input adapter backed by `CircularSampleBuffer`.
 */
export const createCircularStretchInputBufferAdapter: StretchInputBufferAdapterFactory =
  () => new CircularStretchInputBufferAdapter();
const USE_AUTO_SEQUENCE_LEN = 0;
const DEFAULT_SEQUENCE_MS = USE_AUTO_SEQUENCE_LEN;

const USE_AUTO_SEEKWINDOW_LEN = 0;
const DEFAULT_SEEKWINDOW_MS = USE_AUTO_SEEKWINDOW_LEN;

const DEFAULT_OVERLAP_MS = 8;

const AUTOSEQ_TEMPO_LOW = 0.25;
const AUTOSEQ_TEMPO_TOP = 4.0;

const AUTOSEQ_AT_MIN = 125.0;
const AUTOSEQ_AT_MAX = 50.0;
const AUTOSEQ_K =
  (AUTOSEQ_AT_MAX - AUTOSEQ_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
const AUTOSEQ_C = AUTOSEQ_AT_MIN - AUTOSEQ_K * AUTOSEQ_TEMPO_LOW;

const AUTOSEEK_AT_MIN = 25.0;
const AUTOSEEK_AT_MAX = 15.0;
const AUTOSEEK_K =
  (AUTOSEEK_AT_MAX - AUTOSEEK_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
const AUTOSEEK_C = AUTOSEEK_AT_MIN - AUTOSEEK_K * AUTOSEQ_TEMPO_LOW;
const NORMALIZED_CORRELATION_EPSILON = 1e-12;
const QUICK_SEEK_FALLBACK_THRESHOLD = 256;
const QUICK_SEEK_MIN_VALID_CANDIDATES = 8;

/**
 * Time-stretch processor for tempo adjustment without affecting pitch.
 * Used internally by SoundTouch for time-stretching audio.
 */
export default class Stretch
  extends AbstractSamplePipe<SampleBuffer, SampleBuffer>
  implements StretchPipe
{
  private readonly inputBufferAdapterFactory: StretchInputBufferAdapterFactory;
  private readonly sampleBufferFactory: () => SampleBuffer;
  private readonly inputBufferAdapter: StretchReadBufferAdapter;
  private readonly outputBufferAdapter: StretchWriteBufferAdapter;
  private overlapScratch: Float32Array;

  private _quickSeek: boolean;
  private midBufferDirty: boolean;
  midBuffer: Float32Array | null;
  private refMidBuffer!: Float32Array;
  private refMidBufferEnergy: number;
  overlapLength: number;
  private autoSeqSetting: boolean;
  private autoSeekSetting: boolean;
  _tempo: number;
  private sampleRate!: number;
  private _overlapMs!: number;
  sequenceMs!: number;
  seekWindowMs!: number;
  private seekWindowLength!: number;
  private seekLength!: number;
  private nominalSkip!: number;
  private skipFract!: number;
  sampleReq!: number;

  /**
   * Creates a Stretch instance.
   * @param options Constructor options.
   */
  constructor({
    createBuffers = false,
    inputBufferAdapterFactory = createFifoStretchInputBufferAdapter,
    sampleBufferFactory = () => new FifoSampleBuffer(),
  }: StretchConstructorOptions = {}) {
    super({
      createBuffers,
      inputBufferFactory: sampleBufferFactory,
      outputBufferFactory: sampleBufferFactory,
    });
    this.inputBufferAdapterFactory = inputBufferAdapterFactory;
    this.sampleBufferFactory = sampleBufferFactory;
    this.inputBufferAdapter = inputBufferAdapterFactory();
    this.outputBufferAdapter = new GenericStretchWriteBufferAdapter();
    this.overlapScratch = new Float32Array(0);
    this._quickSeek = true;
    this.midBufferDirty = true;

    this.midBuffer = null;
    this.refMidBufferEnergy = 0;
    this.overlapLength = 0;

    this.autoSeqSetting = true;
    this.autoSeekSetting = true;

    this._tempo = 1;
    this.setParameters(
      44100,
      DEFAULT_SEQUENCE_MS,
      DEFAULT_SEEKWINDOW_MS,
      DEFAULT_OVERLAP_MS,
    );
  }

  override clear(): void {
    super.clear();
    this.clearMidBuffer();
  }

  clearMidBuffer(): void {
    this.midBufferDirty = true;

    if (this.midBuffer) {
      this.midBuffer.fill(0);
    }

    if (this.refMidBuffer) {
      this.refMidBuffer.fill(0);
    }

    this.skipFract = 0;
  }

  setParameters(
    sampleRate: number,
    sequenceMs: number,
    seekWindowMs: number,
    overlapMs: number,
  ): void {
    if (sampleRate > 0) {
      this.sampleRate = sampleRate;
    }

    if (overlapMs > 0) {
      this._overlapMs = overlapMs;
    }

    if (sequenceMs > 0) {
      this.sequenceMs = sequenceMs;
      this.autoSeqSetting = false;
    } else {
      this.autoSeqSetting = true;
    }

    if (seekWindowMs > 0) {
      this.seekWindowMs = seekWindowMs;
      this.autoSeekSetting = false;
    } else {
      this.autoSeekSetting = true;
    }

    this.calculateSequenceParameters();
    this.calculateOverlapLength(this._overlapMs);
    this.updateTempoDerivedState();
  }

  set tempo(newTempo: number) {
    this._tempo = newTempo;
    this.updateTempoDerivedState();
  }

  get tempo(): number {
    return this._tempo;
  }

  get inputChunkSize(): number {
    return this.sampleReq;
  }

  get outputChunkSize(): number {
    return (
      this.overlapLength +
      Math.max(0, this.seekWindowLength - 2 * this.overlapLength)
    );
  }

  calculateOverlapLength(overlapInMsec = 0): void {
    let newOvl = (this.sampleRate * overlapInMsec) / 1000;
    newOvl = newOvl < 16 ? 16 : newOvl;

    // must be divisible by 8
    newOvl -= newOvl % 8;

    if (newOvl === this.overlapLength && this.midBuffer !== null) {
      return;
    }

    this.overlapLength = newOvl;
    const needed = this.overlapLength * 2;

    if (!this.refMidBuffer || this.refMidBuffer.length < needed) {
      this.refMidBuffer = new Float32Array(needed);
    }
    if (!this.midBuffer || this.midBuffer.length < needed) {
      this.midBuffer = new Float32Array(needed);
    }
  }

  private checkLimits(x: number, mi: number, ma: number): number {
    return x < mi ? mi : x > ma ? ma : x;
  }

  private calculateSequenceParameters(): void {
    if (this.autoSeqSetting) {
      let seq = AUTOSEQ_C + AUTOSEQ_K * this._tempo;
      seq = this.checkLimits(seq, AUTOSEQ_AT_MAX, AUTOSEQ_AT_MIN);
      this.sequenceMs = Math.floor(seq + 0.5);
    }

    if (this.autoSeekSetting) {
      let seek = AUTOSEEK_C + AUTOSEEK_K * this._tempo;
      seek = this.checkLimits(seek, AUTOSEEK_AT_MAX, AUTOSEEK_AT_MIN);
      this.seekWindowMs = Math.floor(seek + 0.5);
    }

    this.seekWindowLength = Math.floor(
      (this.sampleRate * this.sequenceMs) / 1000,
    );
    this.seekLength = Math.floor((this.sampleRate * this.seekWindowMs) / 1000);
    this.normalizeWindowInvariants();
  }

  private normalizeWindowInvariants(): void {
    this.seekLength = Math.max(1, this.seekLength);
    this.seekWindowLength = Math.max(this.seekWindowLength, this.overlapLength);
  }

  private updateTempoDerivedState(): void {
    this.calculateSequenceParameters();
    this.nominalSkip =
      this._tempo * (this.seekWindowLength - this.overlapLength);
    this.skipFract = 0;
    const intskip = Math.floor(this.nominalSkip + 0.5);
    this.sampleReq =
      Math.max(intskip + this.overlapLength, this.seekWindowLength) +
      this.seekLength;
  }

  /**
   * Whether the fast multi-pass seek algorithm is active.
   * @returns `true` if quick seek is enabled (default); `false` for exhaustive search.
   */
  get quickSeek(): boolean {
    return this._quickSeek;
  }

  set quickSeek(enable: boolean) {
    this._quickSeek = enable;
  }

  /**
   * Current overlap crossfade length in milliseconds.
   * @returns The overlap period used at the current sample rate.
   */
  get overlapMs(): number {
    return this._overlapMs;
  }

  /**
   * Sets the overlap crossfade length and recalculates derived parameters.
   * @param ms Overlap period in milliseconds (must be > 0).
   */
  set overlapMs(ms: number) {
    if (ms > 0) {
      this._overlapMs = ms;
      this.calculateOverlapLength(this._overlapMs);
      this.calculateSequenceParameters();
      this.updateTempoDerivedState();
    }
  }

  /**
   * Applies a partial set of WSOLA timing parameters.
   *
   * @remarks
   * Only the provided fields are updated; omitted fields remain unchanged.
   * Pass `sequenceMs: 0` or `seekWindowMs: 0` to switch that dimension back to auto-calculation.
   *
   * @param params Partial set of WSOLA timing parameters to apply.
   *
   * @example
   * stretch.setStretchParameters({ overlapMs: 12, quickSeek: false });
   */
  setStretchParameters(params: StretchParameters): void {
    if (params.quickSeek !== undefined) {
      this._quickSeek = params.quickSeek;
    }

    let needsRecalc = false;

    if (params.sequenceMs !== undefined) {
      if (params.sequenceMs > 0) {
        this.sequenceMs = params.sequenceMs;
        this.autoSeqSetting = false;
      } else {
        this.autoSeqSetting = true;
      }
      needsRecalc = true;
    }

    if (params.seekWindowMs !== undefined) {
      if (params.seekWindowMs > 0) {
        this.seekWindowMs = params.seekWindowMs;
        this.autoSeekSetting = false;
      } else {
        this.autoSeekSetting = true;
      }
      needsRecalc = true;
    }

    if (params.overlapMs !== undefined && params.overlapMs > 0) {
      this._overlapMs = params.overlapMs;
      this.calculateOverlapLength(this._overlapMs);
      needsRecalc = true;
    }

    if (needsRecalc) {
      this.calculateSequenceParameters();
      this.updateTempoDerivedState();
    }
  }

  clone(): Stretch {
    const result = new Stretch({
      createBuffers: false,
      inputBufferAdapterFactory: this.inputBufferAdapterFactory,
      sampleBufferFactory: this.sampleBufferFactory,
    });
    result.tempo = this._tempo;
    result.setParameters(
      this.sampleRate,
      this.sequenceMs,
      this.seekWindowMs,
      this._overlapMs,
    );
    return result;
  }

  seekBestOverlapPosition(inputBuffer?: StretchReadBufferAdapter): number {
    const resolvedInputBuffer = inputBuffer ?? this.getInputBufferAdapter();
    if (!this._quickSeek || this.seekLength <= QUICK_SEEK_FALLBACK_THRESHOLD) {
      return this.seekBestOverlapPositionStereo(resolvedInputBuffer);
    }
    return this.seekBestOverlapPositionStereoQuick(resolvedInputBuffer);
  }

  private seekBestOverlapPositionStereo(
    inputBuffer: StretchReadBufferAdapter,
  ): number {
    let bestOffset: number;
    let bestCorrelation: number;
    let correlation: number;

    this.preCalculateCorrelationReferenceStereo();

    bestOffset = 0;
    bestCorrelation = -Infinity;

    for (let i = 0; i < this.seekLength; i++) {
      correlation = this.calculateCrossCorrelationStereo(
        2 * i,
        this.refMidBuffer,
        inputBuffer,
      );

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = i;
      }
    }

    return bestOffset;
  }

  private seekBestOverlapPositionStereoQuick(
    inputBuffer: StretchReadBufferAdapter,
  ): number {
    let bestOffset: number;
    let bestCorrelation: number;
    let correlation: number;
    let correlationOffset: number;
    let tempOffset: number;
    let evaluatedCandidates: number;

    this.preCalculateCorrelationReferenceStereo();

    bestOffset = 0;
    bestCorrelation = this.calculateCrossCorrelationStereo(
      0,
      this.refMidBuffer,
      inputBuffer,
    );
    evaluatedCandidates = 1;
    bestOffset = 0;
    correlationOffset = 0;

    for (let scanCount = 0; scanCount < 4; scanCount++) {
      let previousTempOffset = Number.MIN_SAFE_INTEGER;
      const scanOffsets = this.getQuickScanOffsets(scanCount);
      for (const scanOffset of scanOffsets) {
        tempOffset = correlationOffset + scanOffset;
        if (tempOffset === previousTempOffset) {
          continue;
        }
        previousTempOffset = tempOffset;
        if (tempOffset < 0) {
          continue;
        }
        if (tempOffset >= this.seekLength) {
          continue;
        }

        correlation = this.calculateCrossCorrelationStereo(
          2 * tempOffset,
          this.refMidBuffer,
          inputBuffer,
        );
        evaluatedCandidates++;

        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = tempOffset;
        }
      }
      correlationOffset = bestOffset;
    }

    if (evaluatedCandidates < QUICK_SEEK_MIN_VALID_CANDIDATES) {
      return this.seekBestOverlapPositionStereo(inputBuffer);
    }

    return bestOffset;
  }

  private getQuickScanOffsets(stage: number): readonly number[] {
    const maxOffset = Math.max(1, this.seekLength - 1);
    if (stage === 0) {
      return this.generateFractionalScanOffsets(maxOffset, 2, 1, 14, 24);
    }

    if (stage === 1) {
      return this.generateSymmetricScanOffsets(maxOffset, 0.2);
    }

    if (stage === 2) {
      return this.generateSymmetricScanOffsets(maxOffset, 0.06);
    }

    return this.generateSymmetricScanOffsets(maxOffset, 0.015);
  }

  private generateFractionalScanOffsets(
    maxOffset: number,
    startNumerator: number,
    stepNumerator: number,
    denominator: number,
    steps: number,
  ): readonly number[] {
    const offsets: number[] = [];
    const seen = new Set<number>();
    const safeDenominator = Math.max(1, denominator);
    const safeSteps = Math.max(1, steps);

    for (let i = 0; i < safeSteps; i++) {
      const numerator = startNumerator + i * stepNumerator;
      const value = Math.round((maxOffset * numerator) / safeDenominator);
      if (value <= 0 || value >= this.seekLength || seen.has(value)) {
        continue;
      }
      seen.add(value);
      offsets.push(value);
    }

    return offsets;
  }

  private generateSymmetricScanOffsets(
    maxOffset: number,
    spanRatio: number,
  ): readonly number[] {
    const span = Math.max(1, Math.round(maxOffset * spanRatio));
    const scales = [1, 0.75, 0.5, 0.25];
    const negative: number[] = [];
    const positive: number[] = [];
    const seen = new Set<number>();

    for (const scale of scales) {
      const magnitude = Math.max(1, Math.round(span * scale));
      const neg = -magnitude;
      const pos = magnitude;
      if (!seen.has(neg)) {
        seen.add(neg);
        negative.push(neg);
      }
      if (!seen.has(pos)) {
        seen.add(pos);
        positive.push(pos);
      }
    }

    return negative.concat(positive);
  }

  private preCalculateCorrelationReferenceStereo(): void {
    let energy = 0;
    for (let i = 0; i < this.overlapLength; i++) {
      const temp = i * (this.overlapLength - i);
      const ctx = i * 2;
      const left = this.midBuffer![ctx] * temp;
      const right = this.midBuffer![ctx + 1] * temp;
      this.refMidBuffer[ctx] = left;
      this.refMidBuffer[ctx + 1] = right;
      energy += left * left + right * right;
    }
    this.refMidBufferEnergy = energy;
  }

  private calculateCrossCorrelationStereo(
    mixingPos: number,
    compare: Float32Array,
    inputBuffer: StretchReadBufferAdapter,
  ): number {
    mixingPos += inputBuffer.startIndex;

    let dot = 0;
    let sourceEnergy = 0;
    const calcLength = 2 * this.overlapLength;
    const source = inputBuffer.readSubarray(mixingPos, mixingPos + calcLength);

    for (let i = 0; i < calcLength; i += 2) {
      const sourceLeft = i < source.length ? source[i] : 0;
      const sourceRight = i + 1 < source.length ? source[i + 1] : 0;
      const compareLeft = compare[i];
      const compareRight = compare[i + 1];
      dot += sourceLeft * compareLeft + sourceRight * compareRight;
      sourceEnergy += sourceLeft * sourceLeft + sourceRight * sourceRight;
    }

    if (
      sourceEnergy <= NORMALIZED_CORRELATION_EPSILON ||
      this.refMidBufferEnergy <= NORMALIZED_CORRELATION_EPSILON
    ) {
      return -1;
    }

    return dot / Math.sqrt(sourceEnergy * this.refMidBufferEnergy);
  }

  private overlapStereo(
    inputPosition: number,
    inputBuffer: StretchReadBufferAdapter,
    outputBuffer: StretchWriteBufferAdapter,
  ): void {
    inputPosition += inputBuffer.startIndex;
    const overlapSamples = this.overlapLength * 2;
    if (this.overlapScratch.length < overlapSamples) {
      this.overlapScratch = new Float32Array(overlapSamples);
    }
    const output = this.overlapScratch;
    const input = inputBuffer.readSubarray(
      inputPosition,
      inputPosition + overlapSamples,
    );

    const frameScale = 1 / this.overlapLength;

    for (let i = 0; i < this.overlapLength; i++) {
      const tempFrame = (this.overlapLength - i) * frameScale;
      const fi = i * frameScale;
      const ctx = 2 * i;
      const inputLeft = ctx < input.length ? input[ctx] : 0;
      const inputRight = ctx + 1 < input.length ? input[ctx + 1] : 0;
      output[ctx] = inputLeft * fi + this.midBuffer![ctx] * tempFrame;
      output[ctx + 1] = inputRight * fi + this.midBuffer![ctx + 1] * tempFrame;
    }

    outputBuffer.appendSamples(output, this.overlapLength);
  }

  process(): void {
    const inputBuffer = this.getInputBufferAdapter();
    const outputBuffer = this.getOutputBufferAdapter();

    if (!this.bootstrapMidBuffer(inputBuffer)) {
      return;
    }

    while (inputBuffer.frameCount >= this.sampleReq) {
      this.processOneWindow(inputBuffer, outputBuffer);
    }
  }

  private bootstrapMidBuffer(inputBuffer: StretchReadBufferAdapter): boolean {
    if (!this.midBufferDirty) {
      return true;
    }
    if (inputBuffer.frameCount < this.overlapLength) {
      return false;
    }
    const needed = this.overlapLength * 2;
    if (!this.midBuffer || this.midBuffer.length < needed) {
      this.midBuffer = new Float32Array(needed);
    }
    inputBuffer.receiveSamples(this.midBuffer, this.overlapLength);
    this.midBufferDirty = false;
    return true;
  }

  private processOneWindow(
    inputBuffer: StretchReadBufferAdapter,
    outputBuffer: StretchWriteBufferAdapter,
  ): void {
    const offset = this.seekBestOverlapPosition(inputBuffer);
    this.overlapStereo(2 * Math.floor(offset), inputBuffer, outputBuffer);

    const middleFrames = this.seekWindowLength - 2 * this.overlapLength;
    if (middleFrames > 0) {
      outputBuffer.putFrom(
        inputBuffer,
        offset + this.overlapLength,
        middleFrames,
      );
    }

    this.captureOverlapHistory(offset, inputBuffer);
    this.advanceInputByNominalSkip(inputBuffer);
  }

  private captureOverlapHistory(
    offset: number,
    inputBuffer: StretchReadBufferAdapter,
  ): void {
    const start =
      inputBuffer.startIndex +
      2 * (offset + this.seekWindowLength - this.overlapLength);
    this.midBuffer!.set(
      inputBuffer.readSubarray(start, start + 2 * this.overlapLength),
    );
  }

  private advanceInputByNominalSkip(
    inputBuffer: StretchReadBufferAdapter,
  ): void {
    this.skipFract += this.nominalSkip;
    const overlapSkip = Math.floor(this.skipFract);
    this.skipFract -= overlapSkip;
    inputBuffer.receive(overlapSkip);
  }

  private getInputBufferAdapter(): StretchReadBufferAdapter {
    if (this._inputBuffer === null) {
      throw new Error('inputBuffer is not set');
    }
    this.inputBufferAdapter.setBuffer(this._inputBuffer);
    return this.inputBufferAdapter;
  }

  private getOutputBufferAdapter(): StretchWriteBufferAdapter {
    if (this._outputBuffer === null) {
      throw new Error('outputBuffer is not set');
    }
    this.outputBufferAdapter.setOutputBuffer(this._outputBuffer);
    return this.outputBufferAdapter;
  }
}
