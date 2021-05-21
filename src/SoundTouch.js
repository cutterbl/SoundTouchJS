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

import RateTransposer from './RateTransposer.js';
import Stretch from './Stretch.js';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import testFloatEqual from './testFloatEqual.js';

export default class SoundTouch {
  constructor() {
    this.transposer = new RateTransposer(false);
    this.stretch = new Stretch(false);

    this._inputBuffer = new FifoSampleBuffer();
    this._intermediateBuffer = new FifoSampleBuffer();
    this._outputBuffer = new FifoSampleBuffer();

    this._rate = 0;
    this._tempo = 0;

    this.virtualPitch = 1;
    this.virtualRate = 1;
    this.virtualTempo = 1;

    this.calculateEffectiveRateAndTempo();
  }

  clear() {
    this.transposer.clear();
    this.stretch.clear();
  }

  clone() {
    const result = new SoundTouch();
    result.rate = this.rate;
    result.tempo = this.tempo;
    return result;
  }

  get rate() {
    return this._rate;
  }

  set rate(rate) {
    this.virtualRate = rate;
    this.calculateEffectiveRateAndTempo();
  }

  set rateChange(rateChange) {
    this._rate = 1 + 0.01 * rateChange;
  }

  get tempo() {
    return this._tempo;
  }

  set tempo(tempo) {
    this.virtualTempo = tempo;
    this.calculateEffectiveRateAndTempo();
  }

  set tempoChange(tempoChange) {
    this.tempo = 1 + 0.01 * tempoChange;
  }

  set pitch(pitch) {
    this.virtualPitch = pitch;
    this.calculateEffectiveRateAndTempo();
  }

  set pitchOctaves(pitchOctaves) {
    this.pitch = Math.exp(0.69314718056 * pitchOctaves);
    this.calculateEffectiveRateAndTempo();
  }

  set pitchSemitones(pitchSemitones) {
    this.pitchOctaves = pitchSemitones / 12;
  }

  get inputBuffer() {
    return this._inputBuffer;
  }

  get outputBuffer() {
    return this._outputBuffer;
  }

  calculateEffectiveRateAndTempo() {
    const previousTempo = this._tempo;
    const previousRate = this._rate;

    this._tempo = this.virtualTempo / this.virtualPitch;
    this._rate = this.virtualRate * this.virtualPitch;

    if (testFloatEqual(this._tempo, previousTempo)) {
      this.stretch.tempo = this._tempo;
    }
    if (testFloatEqual(this._rate, previousRate)) {
      this.transposer.rate = this._rate;
    }

    if (this._rate > 1) {
      if (this._outputBuffer !== this.transposer.outputBuffer) {
        this.stretch.inputBuffer = this._inputBuffer;
        this.stretch.outputBuffer = this._intermediateBuffer;

        this.transposer.inputBuffer = this._intermediateBuffer;
        this.transposer.outputBuffer = this._outputBuffer;
      }
    } else {
      // rome-ignore lint/js/noDoubleEquals
      if (this._outputBuffer != this.stretch.outputBuffer) {
        this.transposer.inputBuffer = this._inputBuffer;
        this.transposer.outputBuffer = this._intermediateBuffer;

        this.stretch.inputBuffer = this._intermediateBuffer;
        this.stretch.outputBuffer = this._outputBuffer;
      }
    }
  }

  process() {
    if (this._rate > 1) {
      this.stretch.process();
      this.transposer.process();
    } else {
      this.transposer.process();
      this.stretch.process();
    }
  }
}
