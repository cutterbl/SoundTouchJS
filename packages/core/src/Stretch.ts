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
 * version 2.1 of the License, or (at your option) any later version.
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

import AbstractFifoSamplePipe from './AbstractFifoSamplePipe.js';

const USE_AUTO_SEQUENCE_LEN = 0;
const DEFAULT_SEQUENCE_MS = USE_AUTO_SEQUENCE_LEN;

const USE_AUTO_SEEKWINDOW_LEN = 0;
const DEFAULT_SEEKWINDOW_MS = USE_AUTO_SEEKWINDOW_LEN;

const DEFAULT_OVERLAP_MS = 8;

const _SCAN_OFFSETS: readonly (readonly number[])[] = [
  [
    124, 186, 248, 310, 372, 434, 496, 558, 620, 682, 744, 806, 868, 930, 992,
    1054, 1116, 1178, 1240, 1302, 1364, 1426, 1488, 0,
  ],
  [
    -100, -75, -50, -25, 25, 50, 75, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0,
  ],
  [
    -20, -15, -10, -5, 5, 10, 15, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0,
  ],
  [-4, -3, -2, -1, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

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

/**
 * Time-stretch processor for tempo adjustment without affecting pitch.
 * Used internally by SoundTouch for time-stretching audio.
 */
export default class Stretch extends AbstractFifoSamplePipe {
  private _quickSeek: boolean;
  private midBufferDirty: boolean;
  midBuffer: Float32Array | null;
  private refMidBuffer!: Float32Array;
  overlapLength: number;
  private autoSeqSetting: boolean;
  private autoSeekSetting: boolean;
  _tempo: number;
  private sampleRate!: number;
  private overlapMs!: number;
  sequenceMs!: number;
  seekWindowMs!: number;
  private seekWindowLength!: number;
  private seekLength!: number;
  private nominalSkip!: number;
  private skipFract!: number;
  sampleReq!: number;

  /**
   * Creates a Stretch instance.
   * @param createBuffers - Whether to allocate internal buffers
   */
  constructor(createBuffers?: boolean) {
    super(createBuffers);
    this._quickSeek = true;
    this.midBufferDirty = true;

    this.midBuffer = null;
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
      this.overlapMs = overlapMs;
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
    this.calculateOverlapLength(this.overlapMs);
    this.tempo = this._tempo;
  }

  set tempo(newTempo: number) {
    this._tempo = newTempo;

    this.calculateSequenceParameters();

    this.nominalSkip =
      this._tempo * (this.seekWindowLength - this.overlapLength);
    this.skipFract = 0;
    const intskip = Math.floor(this.nominalSkip + 0.5);

    this.sampleReq =
      Math.max(intskip + this.overlapLength, this.seekWindowLength) +
      this.seekLength;
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
  }

  set quickSeek(enable: boolean) {
    this._quickSeek = enable;
  }

  clone(): Stretch {
    const result = new Stretch();
    result.tempo = this._tempo;
    result.setParameters(
      this.sampleRate,
      this.sequenceMs,
      this.seekWindowMs,
      this.overlapMs,
    );
    return result;
  }

  seekBestOverlapPosition(): number {
    return this._quickSeek
      ? this.seekBestOverlapPositionStereoQuick()
      : this.seekBestOverlapPositionStereo();
  }

  private seekBestOverlapPositionStereo(): number {
    let bestOffset: number;
    let bestCorrelation: number;
    let correlation: number;

    this.preCalculateCorrelationReferenceStereo();

    bestOffset = 0;
    bestCorrelation = Number.MIN_VALUE;

    for (let i = 0; i < this.seekLength; i++) {
      correlation = this.calculateCrossCorrelationStereo(
        2 * i,
        this.refMidBuffer,
      );

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = i;
      }
    }

    return bestOffset;
  }

  private seekBestOverlapPositionStereoQuick(): number {
    let bestOffset: number;
    let bestCorrelation: number;
    let correlation: number;
    let correlationOffset: number;
    let tempOffset: number;

    this.preCalculateCorrelationReferenceStereo();

    bestCorrelation = Number.MIN_VALUE;
    bestOffset = 0;
    correlationOffset = 0;

    for (let scanCount = 0; scanCount < 4; scanCount++) {
      let j = 0;
      while (_SCAN_OFFSETS[scanCount][j]) {
        tempOffset = correlationOffset + _SCAN_OFFSETS[scanCount][j];
        if (tempOffset >= this.seekLength) {
          break;
        }

        correlation = this.calculateCrossCorrelationStereo(
          2 * tempOffset,
          this.refMidBuffer,
        );

        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = tempOffset;
        }
        j++;
      }
      correlationOffset = bestOffset;
    }

    return bestOffset;
  }

  private preCalculateCorrelationReferenceStereo(): void {
    for (let i = 0; i < this.overlapLength; i++) {
      const temp = i * (this.overlapLength - i);
      const ctx = i * 2;
      this.refMidBuffer[ctx] = this.midBuffer![ctx] * temp;
      this.refMidBuffer[ctx + 1] = this.midBuffer![ctx + 1] * temp;
    }
  }

  private calculateCrossCorrelationStereo(
    mixingPos: number,
    compare: Float32Array,
  ): number {
    const mixing = this._inputBuffer!.vector;
    mixingPos += this._inputBuffer!.startIndex;

    let correlation = 0;
    const calcLength = 2 * this.overlapLength;

    for (let i = 2; i < calcLength; i += 2) {
      const mixingOffset = i + mixingPos;
      correlation +=
        mixing[mixingOffset] * compare[i] +
        mixing[mixingOffset + 1] * compare[i + 1];
    }

    return correlation;
  }

  private overlap(overlapPosition: number): void {
    this.overlapStereo(2 * overlapPosition);
  }

  private overlapStereo(inputPosition: number): void {
    const input = this._inputBuffer!.vector;
    inputPosition += this._inputBuffer!.startIndex;

    const output = this._outputBuffer!.vector;
    const outputPosition = this._outputBuffer!.endIndex;

    const frameScale = 1 / this.overlapLength;

    for (let i = 0; i < this.overlapLength; i++) {
      const tempFrame = (this.overlapLength - i) * frameScale;
      const fi = i * frameScale;
      const ctx = 2 * i;
      const inputOffset = ctx + inputPosition;
      const outputOffset = ctx + outputPosition;
      output[outputOffset] =
        input[inputOffset] * fi + this.midBuffer![ctx] * tempFrame;
      output[outputOffset + 1] =
        input[inputOffset + 1] * fi + this.midBuffer![ctx + 1] * tempFrame;
    }
  }

  process(): void {
    if (this.midBufferDirty) {
      if (this._inputBuffer!.frameCount < this.overlapLength) {
        return;
      }
      const needed = this.overlapLength * 2;
      if (!this.midBuffer || this.midBuffer.length < needed) {
        this.midBuffer = new Float32Array(needed);
      }
      this._inputBuffer!.receiveSamples(this.midBuffer, this.overlapLength);
      this.midBufferDirty = false;
    }

    while (this._inputBuffer!.frameCount >= this.sampleReq) {
      const offset = this.seekBestOverlapPosition();

      this._outputBuffer!.ensureAdditionalCapacity(this.overlapLength);
      this.overlap(Math.floor(offset));
      this._outputBuffer!.put(this.overlapLength);

      const temp = this.seekWindowLength - 2 * this.overlapLength;
      if (temp > 0) {
        this._outputBuffer!.putBuffer(
          this._inputBuffer!,
          offset + this.overlapLength,
          temp,
        );
      }

      const start =
        this._inputBuffer!.startIndex +
        2 * (offset + this.seekWindowLength - this.overlapLength);
      this.midBuffer!.set(
        this._inputBuffer!.vector.subarray(
          start,
          start + 2 * this.overlapLength,
        ),
      );

      this.skipFract += this.nominalSkip;
      const overlapSkip = Math.floor(this.skipFract);
      this.skipFract -= overlapSkip;
      this._inputBuffer!.receive(overlapSkip);
    }
  }
}
