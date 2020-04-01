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

import WebAudioBufferSource from './WebAudioBufferSource';
import getWebAudioNode from './getWebAudioNode';
import SoundTouch from './SoundTouch';
import SimpleFilter from './SimpleFilter';
import minsSecs from './minsSecs';
import noop from './noop';

const onUpdate = function (sourcePosition) {
  const currentTimePlayed = this.timePlayed;
  const sampleRate = this.sampleRate;
  this.sourcePosition = sourcePosition;
  this.timePlayed = sourcePosition / sampleRate;
  if (currentTimePlayed !== this.timePlayed) {
    const timePlayed = new CustomEvent('play', {
      detail: {
        timePlayed: this.timePlayed,
        formattedTimePlayed: this.formattedTimePlayed,
        percentagePlayed: this.percentagePlayed,
      },
    });
    this._node.dispatchEvent(timePlayed);
  }
};

export default class PitchShifter {
  constructor(context, buffer, bufferSize, onEnd = noop) {
    this._soundtouch = new SoundTouch();
    const source = new WebAudioBufferSource(buffer);
    this.timePlayed = 0;
    this.sourcePosition = 0;
    this._filter = new SimpleFilter(source, this._soundtouch, onEnd);
    this._node = getWebAudioNode(
      context,
      this._filter,
      (sourcePostion) => onUpdate.call(this, sourcePostion),
      bufferSize
    );
    this.tempo = 1;
    this.rate = 1;
    this.duration = buffer.duration;
    this.sampleRate = context.sampleRate;
    this.listeners = [];
  }

  get formattedDuration() {
    return minsSecs(this.duration);
  }

  get formattedTimePlayed() {
    return minsSecs(this.timePlayed);
  }

  get percentagePlayed() {
    return (
      (100 * this._filter.sourcePosition) / (this.duration * this.sampleRate)
    );
  }

  set percentagePlayed(perc) {
    this._filter.sourcePosition = parseInt(
      perc * this.duration * this.sampleRate
    );
    this.sourcePosition = this._filter.sourcePosition;
    this.timePlayed = this.sourcePosition / this.sampleRate;
  }

  get node() {
    return this._node;
  }

  set pitch(pitch) {
    this._soundtouch.pitch = pitch;
  }

  set pitchSemitones(semitone) {
    this._soundtouch.pitchSemitones = semitone;
  }

  set rate(rate) {
    this._soundtouch.rate = rate;
  }

  set tempo(tempo) {
    this._soundtouch.tempo = tempo;
  }

  connect(toNode) {
    this._node.connect(toNode);
  }

  disconnect() {
    this._node.disconnect();
  }

  on(eventName, cb) {
    this.listeners.push({ name: eventName, cb: cb });
    this._node.addEventListener(eventName, (event) => cb(event.detail));
  }

  off(eventName = null) {
    let listeners = this.listeners;
    if (eventName) {
      listeners = listeners.filter((e) => e.name === eventName);
    }
    listeners.forEach((e) => {
      this._node.removeEventListener(e.name, (event) => e.cb(event.detail));
    });
  }
}
