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

import WebAudioBufferSource from './WebAudioBufferSource.js';
import getWebAudioNode from './getWebAudioNode.js';
import SoundTouch from './SoundTouch.js';
import SimpleFilter from './SimpleFilter.js';
import minsSecs from './minsSecs.js';
import noop from './noop.js';

/** Detail object emitted with the 'play' event. */
export interface PlayEventDetail {
  timePlayed: number;
  formattedTimePlayed: string;
  percentagePlayed: number;
}

interface EventListener {
  name: string;
  cb: (detail: PlayEventDetail) => void;
}

function onUpdate(this: PitchShifter, sourcePosition: number): void {
  const currentTimePlayed = this.timePlayed;
  const sampleRate = this.sampleRate;
  this.sourcePosition = sourcePosition;
  this.timePlayed = sourcePosition / sampleRate;
  if (currentTimePlayed !== this.timePlayed) {
    const timePlayed = new CustomEvent<PlayEventDetail>('play', {
      detail: {
        timePlayed: this.timePlayed,
        formattedTimePlayed: this.formattedTimePlayed,
        percentagePlayed: this.percentagePlayed,
      },
    });
    this._node.dispatchEvent(timePlayed);
  }
}

/**
 * High-level wrapper for real-time pitch shifting using ScriptProcessorNode.
 * Handles buffering, playback tracking, and parameter control.
 */
export default class PitchShifter {
  private _soundtouch: SoundTouch;
  private _filter: SimpleFilter;
  /** @internal */
  _node: ScriptProcessorNode;

  timePlayed: number;
  sourcePosition: number;
  duration: number;
  sampleRate: number;
  listeners: EventListener[];

  /**
   * Creates a PitchShifter instance for an AudioBuffer.
   * @param context - AudioContext or OfflineAudioContext
   * @param buffer - Source AudioBuffer
   * @param bufferSize - Size of ScriptProcessorNode buffer
   * @param onEnd - Callback when playback ends
   */
  constructor(
    context: BaseAudioContext,
    buffer: AudioBuffer,
    bufferSize: number,
    onEnd: () => void = noop,
  ) {
    this._soundtouch = new SoundTouch();
    const source = new WebAudioBufferSource(buffer);
    this.timePlayed = 0;
    this.sourcePosition = 0;
    this._filter = new SimpleFilter(source, this._soundtouch, onEnd);
    this._node = getWebAudioNode(
      context,
      this._filter,
      (pos) => onUpdate.call(this, pos),
      bufferSize,
    );
    this.tempo = 1;
    this.rate = 1;
    this.duration = buffer.duration;
    this.sampleRate = context.sampleRate;
    this.listeners = [];
  }

  get formattedDuration(): string {
    return minsSecs(this.duration);
  }

  get formattedTimePlayed(): string {
    return minsSecs(this.timePlayed);
  }

  get percentagePlayed(): number {
    return (
      (100 * this._filter.sourcePosition) / (this.duration * this.sampleRate)
    );
  }

  set percentagePlayed(perc: number) {
    this._filter.sourcePosition = Math.floor(
      perc * this.duration * this.sampleRate,
    );
    this.sourcePosition = this._filter.sourcePosition;
    this.timePlayed = this.sourcePosition / this.sampleRate;
  }

  get node(): ScriptProcessorNode {
    return this._node;
  }

  set pitch(pitch: number) {
    this._soundtouch.pitch = pitch;
  }

  set pitchSemitones(semitone: number) {
    this._soundtouch.pitchSemitones = semitone;
  }

  set rate(rate: number) {
    this._soundtouch.rate = rate;
  }

  set tempo(tempo: number) {
    this._soundtouch.tempo = tempo;
  }

  connect(toNode: AudioNode): void {
    this._node.connect(toNode);
  }

  disconnect(): void {
    this._node.disconnect();
  }

  on(eventName: string, cb: (detail: PlayEventDetail) => void): void {
    this.listeners.push({ name: eventName, cb });
    this._node.addEventListener(eventName, ((
      event: CustomEvent<PlayEventDetail>,
    ) => cb(event.detail)) as EventListener_2);
  }

  off(eventName: string | null = null): void {
    let listeners = this.listeners;
    if (eventName) {
      listeners = listeners.filter((e) => e.name === eventName);
    }
    listeners.forEach((e) => {
      this._node.removeEventListener(e.name, ((
        event: CustomEvent<PlayEventDetail>,
      ) => e.cb(event.detail)) as EventListener_2);
    });
  }
}

// Alias to avoid conflict with our EventListener interface
type EventListener_2 = globalThis.EventListener;
