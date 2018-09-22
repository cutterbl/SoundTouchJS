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

import AbstractFifoSamplePipe from './AbstractFifoSamplePipe';

/**
 * Giving this value for the sequence length sets automatic parameter value
 * according to tempo setting (recommended)
 */
const USE_AUTO_SEQUENCE_LEN = 0;

/**
 * Default length of a single processing sequence, in milliseconds. This determines to how
 * long sequences the original sound is chopped in the time-stretch algorithm.
 *
 * The larger this value is, the lesser sequences are used in processing. In principle
 * a bigger value sounds better when slowing down tempo, but worse when increasing tempo
 * and vice versa.
 *
 * Increasing this value reduces computational burden and vice versa.
 */
//const DEFAULT_SEQUENCE_MS = 130
const DEFAULT_SEQUENCE_MS = USE_AUTO_SEQUENCE_LEN;

/**
 * Giving this value for the seek window length sets automatic parameter value
 * according to tempo setting (recommended)
 */
const USE_AUTO_SEEKWINDOW_LEN = 0;

/**
 * Seeking window default length in milliseconds for algorithm that finds the best possible
 * overlapping location. This determines from how wide window the algorithm may look for an
 * optimal joining location when mixing the sound sequences back together.
 *
 * The bigger this window setting is, the higher the possibility to find a better mixing
 * position will become, but at the same time large values may cause a "drifting" artifact
 * because consequent sequences will be taken at more uneven intervals.
 *
 * If there's a disturbing artifact that sounds as if a constant frequency was drifting
 * around, try reducing this setting.
 *
 * Increasing this value increases computational burden and vice versa.
 */
//const DEFAULT_SEEKWINDOW_MS = 25;
const DEFAULT_SEEKWINDOW_MS = USE_AUTO_SEEKWINDOW_LEN;

/**
 * Overlap length in milliseconds. When the chopped sound sequences are mixed back together,
 * to form a continuous sound stream, this parameter defines over how long period the two
 * consecutive sequences are let to overlap each other.
 *
 * This shouldn't be that critical parameter. If you reduce the DEFAULT_SEQUENCE_MS setting
 * by a large amount, you might wish to try a smaller value on this.
 *
 * Increasing this value increases computational burden and vice versa.
 */
const DEFAULT_OVERLAP_MS = 8;

// Table for the hierarchical mixing position seeking algorithm
const _SCAN_OFFSETS = [
  [
    124,
    186,
    248,
    310,
    372,
    434,
    496,
    558,
    620,
    682,
    744,
    806,
    868,
    930,
    992,
    1054,
    1116,
    1178,
    1240,
    1302,
    1364,
    1426,
    1488,
    0
  ],
  [
    -100,
    -75,
    -50,
    -25,
    25,
    50,
    75,
    100,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    -20,
    -15,
    -10,
    -5,
    5,
    10,
    15,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [-4, -3, -2, -1, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

// Adjust tempo param according to tempo, so that variating processing sequence length is used
// at varius tempo settings, between the given low...top limits
const AUTOSEQ_TEMPO_LOW = 0.5; // auto setting low tempo range (-50%)
const AUTOSEQ_TEMPO_TOP = 2.0; // auto setting top tempo range (+100%)

// sequence-ms setting values at above low & top tempo
const AUTOSEQ_AT_MIN = 125.0;
const AUTOSEQ_AT_MAX = 50.0;
const AUTOSEQ_K =
  (AUTOSEQ_AT_MAX - AUTOSEQ_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
const AUTOSEQ_C = AUTOSEQ_AT_MIN - AUTOSEQ_K * AUTOSEQ_TEMPO_LOW;

// seek-window-ms setting values at above low & top tempo
const AUTOSEEK_AT_MIN = 25.0;
const AUTOSEEK_AT_MAX = 15.0;
const AUTOSEEK_K =
  (AUTOSEEK_AT_MAX - AUTOSEEK_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
const AUTOSEEK_C = AUTOSEEK_AT_MIN - AUTOSEEK_K * AUTOSEQ_TEMPO_LOW;

export default class Stretch extends AbstractFifoSamplePipe {
  constructor(createBuffers) {
    super(createBuffers);
    this._quickSeek = true;
    this.midBufferDirty = false;

    this.midBuffer = null;
    this.overlapLength = 0;

    this.autoSeqSetting = true;
    this.autoSeekSetting = true;

    this._tempo = 1;
    this.setParameters(
      44100,
      DEFAULT_SEQUENCE_MS,
      DEFAULT_SEEKWINDOW_MS,
      DEFAULT_OVERLAP_MS
    );
  }

  clear() {
    super.clear();
    this.clearMidBuffer();
  }

  clearMidBuffer() {
    if (this.midBufferDirty) {
      this.midBufferDirty = false;
      this.midBuffer = null;
    }
  }

  /**
   * Sets routine control parameters. These control are certain time constants
   * defining how the sound is stretched to the desired duration.
   *
   * 'sampleRate' = sample rate of the sound
   * 'sequenceMS' = one processing sequence length in milliseconds (default = 82 ms)
   * 'seekwindowMS' = seeking window length for scanning the best overlapping
   *      position (default = 28 ms)
   * 'overlapMS' = overlapping length (default = 12 ms)
   */
  setParameters(sampleRate, sequenceMs, seekWindowMs, overlapMs) {
    // accept only positive parameter values - if zero or negative, use old values instead
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
      // zero or below, use automatic setting
      this.autoSeqSetting = true;
    }

    if (seekWindowMs > 0) {
      this.seekWindowMs = seekWindowMs;
      this.autoSeekSetting = false;
    } else {
      // zero or below, use automatic setting
      this.autoSeekSetting = true;
    }

    this.calculateSequenceParameters();

    this.calculateOverlapLength(this.overlapMs);

    // set tempo to recalculate 'sampleReq'
    this.tempo = this._tempo;
  }

  /**
   * Sets new target tempo. Normal tempo = 'SCALE', smaller values represent slower
   * tempo, larger faster tempo.
   */
  set tempo(newTempo) {
    let intskip;

    this._tempo = newTempo;

    // Calculate new sequence duration
    this.calculateSequenceParameters();

    // Calculate ideal skip length (according to tempo value)
    this.nominalSkip =
      this._tempo * (this.seekWindowLength - this.overlapLength);
    this.skipFract = 0;
    intskip = Math.floor(this.nominalSkip + 0.5);

    // Calculate how many samples are needed in the 'inputBuffer' to process another batch of samples
    this.sampleReq =
      Math.max(intskip + this.overlapLength, this.seekWindowLength) +
      this.seekLength;
  }

  get tempo() {
    return this._tempo;
  }

  get inputChunkSize() {
    return this.sampleReq;
  }

  get outputChunkSize() {
    return (
      this.overlapLength +
      Math.max(0, this.seekWindowLength - 2 * this.overlapLength)
    );
  }

  /**
   * Calculates overlapInMsec period length in samples.
   */
  calculateOverlapLength(overlapInMsec = 0) {
    let newOvl;

    // TODO assert(overlapInMsec >= 0);
    newOvl = (this.sampleRate * overlapInMsec) / 1000;
    newOvl = newOvl < 16 ? 16 : newOvl;

    // must be divisible by 8
    newOvl -= newOvl % 8;

    this.overlapLength = newOvl;

    this.refMidBuffer = new Float32Array(this.overlapLength * 2);
    this.midBuffer = new Float32Array(this.overlapLength * 2);
  }

  checkLimits(x, mi, ma) {
    return x < mi ? mi : x > ma ? ma : x;
  }

  /**
   * Calculates processing sequence length according to tempo setting
   */
  calculateSequenceParameters() {
    let seq;
    let seek;

    if (this.autoSeqSetting) {
      seq = AUTOSEQ_C + AUTOSEQ_K * this._tempo;
      seq = this.checkLimits(seq, AUTOSEQ_AT_MAX, AUTOSEQ_AT_MIN);
      this.sequenceMs = Math.floor(seq + 0.5);
    }

    if (this.autoSeekSetting) {
      seek = AUTOSEEK_C + AUTOSEEK_K * this._tempo;
      seek = this.checkLimits(seek, AUTOSEEK_AT_MAX, AUTOSEEK_AT_MIN);
      this.seekWindowMs = Math.floor(seek + 0.5);
    }

    // Update seek window lengths
    this.seekWindowLength = Math.floor(
      (this.sampleRate * this.sequenceMs) / 1000
    );
    this.seekLength = Math.floor((this.sampleRate * this.seekWindowMs) / 1000);
  }

  /**
   * Enables/disables the quick position seeking algorithm.
   */
  set quickSeek(enable) {
    this._quickSeek = enable;
  }

  clone() {
    const result = new Stretch();
    result.tempo = this._tempo;
    result.setParameters(
      this.sampleRate,
      this.sequenceMs,
      this.seekWindowMs,
      this.overlapMs
    );
    return result;
  }

  /**
   * Seeks for the optimal overlap-mixing position.
   */
  seekBestOverlapPosition() {
    return this._quickSeek
      ? this.seekBestOverlapPositionStereoQuick()
      : this.seekBestOverlapPositionStereo();
  }

  /**
   * Seeks for the optimal overlap-mixing position. The 'stereo' version of the
   * routine
   *
   * The best position is determined as the position where the two overlapped
   * sample sequences are 'most alike', in terms of the highest cross-correlation
   * value over the overlapping period
   */
  seekBestOverlapPositionStereo() {
    let bestOffset;
    let bestCorrelation;
    let correlation;
    let i = 0;

    // Slopes the amplitudes of the 'midBuffer' samples
    this.preCalculateCorrelationReferenceStereo();

    bestOffset = 0;
    bestCorrelation = Number.MIN_VALUE;

    // Scans for the best correlation value by testing each possible position over the permitted range
    for (; i < this.seekLength; i = i + 1) {
      // Calculates correlation value for the mixing position corresponding to 'i'
      correlation = this.calculateCrossCorrelationStereo(
        2 * i,
        this.refMidBuffer
      );

      // Checks for the highest correlation value
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = i;
      }
    }

    return bestOffset;
  }

  /**
   * Seeks for the optimal overlap-mixing position. The 'stereo' version of the
   * routine
   *
   * The best position is determined as the position where the two overlapped
   * sample sequences are 'most alike', in terms of the highest cross-correlation
   * value over the overlapping period
   */
  seekBestOverlapPositionStereoQuick() {
    let bestOffset;
    let bestCorrelation;
    let correlation;
    let scanCount = 0;
    let correlationOffset;
    let tempOffset;

    // Slopes the amplitude of the 'midBuffer' samples
    this.preCalculateCorrelationReferenceStereo();

    bestCorrelation = Number.MIN_VALUE;
    bestOffset = 0;
    correlationOffset = 0;
    tempOffset = 0;

    // Scans for the best correlation value using four-pass hierarchical search.
    //
    // The look-up table 'scans' has hierarchical position adjusting steps.
    // In first pass the routine searhes for the highest correlation with
    // relatively coarse steps, then rescans the neighbourhood of the highest
    // correlation with better resolution and so on.
    for (; scanCount < 4; scanCount = scanCount + 1) {
      let j = 0;
      while (_SCAN_OFFSETS[scanCount][j]) {
        tempOffset = correlationOffset + _SCAN_OFFSETS[scanCount][j];
        if (tempOffset >= this.seekLength) {
          break;
        }

        // Calculates correlation value for the mixing position corresponding to 'tempOffset'
        correlation = this.calculateCrossCorrelationStereo(
          2 * tempOffset,
          this.refMidBuffer
        );

        // Checks for the highest correlation value
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = tempOffset;
        }
        j = j + 1;
      }
      correlationOffset = bestOffset;
    }

    return bestOffset;
  }

  /**
   * Slopes the amplitude of the 'midBuffer' samples so that cross correlation
   * is faster to calculate
   */
  preCalculateCorrelationReferenceStereo() {
    let i = 0;
    let context;
    let temp;

    for (; i < this.overlapLength; i = i + 1) {
      temp = i * (this.overlapLength - i);
      context = i * 2;
      this.refMidBuffer[context] = this.midBuffer[context] * temp;
      this.refMidBuffer[context + 1] = this.midBuffer[context + 1] * temp;
    }
  }

  calculateCrossCorrelationStereo(mixingPosition, compare) {
    const mixing = this._inputBuffer.vector;
    mixingPosition += this._inputBuffer.startIndex;

    let correlation = 0;
    let i = 2;
    const calcLength = 2 * this.overlapLength;
    let mixingOffset;

    for (; i < calcLength; i = i + 2) {
      mixingOffset = i + mixingPosition;
      correlation +=
        mixing[mixingOffset] * compare[i] +
        mixing[mixingOffset + 1] * compare[i + 1];
    }

    return correlation;
  }

  // TODO inline
  /**
   * Overlaps samples in 'midBuffer' with the samples in 'pInputBuffer' at position
   * of 'ovlPos'.
   */
  overlap(overlapPosition) {
    this.overlapStereo(2 * overlapPosition);
  }

  /**
   * Overlaps samples in 'midBuffer' with the samples in 'pInput'
   */
  overlapStereo(inputPosition) {
    const input = this._inputBuffer.vector;
    inputPosition += this._inputBuffer.startIndex;

    const output = this._outputBuffer.vector;
    const outputPosition = this._outputBuffer.endIndex;

    let i = 0;
    let context;
    let tempFrame;
    const frameScale = 1 / this.overlapLength;
    let fi;
    let inputOffset;
    let outputOffset;

    for (; i < this.overlapLength; i = i + 1) {
      tempFrame = (this.overlapLength - i) * frameScale;
      fi = i * frameScale;
      context = 2 * i;
      inputOffset = context + inputPosition;
      outputOffset = context + outputPosition;
      output[outputOffset + 0] =
        input[inputOffset + 0] * fi + this.midBuffer[context + 0] * tempFrame;
      output[outputOffset + 1] =
        input[inputOffset + 1] * fi + this.midBuffer[context + 1] * tempFrame;
    }
  }

  process() {
    let offset;
    let temp;
    let overlapSkip;

    if (this.midBuffer === null) {
      // if midBuffer is empty, move the first samples of the input stream into it
      if (this._inputBuffer.frameCount < this.overlapLength) {
        // wait until we've got the overlapLength samples
        return;
      }
      this.midBuffer = new Float32Array(this.overlapLength * 2);
      this._inputBuffer.receiveSamples(this.midBuffer, this.overlapLength);
    }

    // Process samples as long as there are enough samples in 'inputBuffer' to form a processing frame
    while (this._inputBuffer.frameCount >= this.sampleReq) {
      // If tempo differs from the normal ('SCALE'), scan for hte best overlapping position
      offset = this.seekBestOverlapPosition();

      /**
       * Mix the samples in the 'inputBuffer' at position of 'offset' with the samples in 'midBuffer'
       * using sliding overlapping
       * ... first partially overlap with the end of the previous sequence (that's in 'midBuffer')
       */
      this._outputBuffer.ensureAdditionalCapacity(this.overlapLength);
      // FIXME unit?
      // overlap(uint(offset));
      this.overlap(Math.floor(offset));
      this._outputBuffer.put(this.overlapLength);

      // ... then copy sequence samples from 'inputBuffer' to output
      temp = this.seekWindowLength - 2 * this.overlapLength; // & 0xfffffffe;
      if (temp > 0) {
        this._outputBuffer.putBuffer(
          this._inputBuffer,
          offset + this.overlapLength,
          temp
        );
      }

      /**
       * Copies the end of the current sequence from 'inputBuffer' to 'midBuffer' for being mixed with
       * the beginning of the next processing sequence and so on
       */
      // assert(offset + seekWindowLength <= (int)inputBuffer.numSamples());
      const start =
        this._inputBuffer.startIndex +
        2 * (offset + this.seekWindowLength - this.overlapLength);
      this.midBuffer.set(
        this._inputBuffer.vector.subarray(start, start + 2 * this.overlapLength)
      );

      /**
       * Remove the processed samples from the input buffer. Update the difference between
       * integer & nominal skip step to 'skipFract' in order to prevent the error from
       * accumulating over time
       */
      this.skipFract += this.nominalSkip; // real skip size
      overlapSkip = Math.floor(this.skipFract);
      this.skipFract -= overlapSkip;
      this._inputBuffer.receive(overlapSkip);
    }
  }
}
