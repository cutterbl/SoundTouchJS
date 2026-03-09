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

/**
 * Detail object emitted with the 'play' event.
 * Contains playback time, formatted time, and percentage played.
 */
export interface PlayEventDetail {
  /** Seconds played so far. */
  timePlayed: number;
  /** Formatted time string (mm:ss). */
  formattedTimePlayed: string;
  /** Percentage of buffer played (0-100). */
  percentagePlayed: number;
}

/**
 * Listener for custom playback events.
 */
interface EventListener {
  /** Event name (e.g. 'play'). */
  name: string;
  /** Callback for event detail. */
  cb: (detail: PlayEventDetail) => void;
}

/**
 * Internal update handler for playback position.
 * Dispatches 'play' event if timePlayed changes.
 * @param sourcePosition Current sample position in buffer.
 */
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
 *
 * @remarks
 * Provides pitch, rate, and tempo control for an AudioBuffer source.
 * Emits 'play' events for playback progress.
 */
export default class PitchShifter {
  /** Internal SoundTouch processor. */
  private _soundtouch: SoundTouch;
  /** Internal filter for sample processing. */
  private _filter: SimpleFilter;
  /** Internal ScriptProcessorNode for audio output. */
  _node: ScriptProcessorNode;

  /** Seconds played so far. */
  timePlayed: number;
  /** Current sample position in buffer. */
  sourcePosition: number;
  /** Duration of the source buffer (seconds). */
  duration: number;
  /** Sample rate of the audio context. */
  sampleRate: number;
  /** Registered event listeners. */
  listeners: EventListener[];

  /**
   * Creates a PitchShifter instance for an AudioBuffer.
   * @param context AudioContext or OfflineAudioContext
   * @param buffer Source AudioBuffer
   * @param bufferSize Size of ScriptProcessorNode buffer
   * @param onEnd Callback when playback ends
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

  /**
   * Returns formatted duration string (mm:ss).
   */
  get formattedDuration(): string {
    return minsSecs(this.duration);
  }

  /**
   * Returns formatted time played string (mm:ss).
   */
  get formattedTimePlayed(): string {
    return minsSecs(this.timePlayed);
  }

  /**
   * Returns percentage of buffer played (0-100).
   */
  get percentagePlayed(): number {
    return (
      (100 * this._filter.sourcePosition) / (this.duration * this.sampleRate)
    );
  }

  /**
   * Sets playback position by percentage.
   * @param perc Percentage (0-100).
   */
  set percentagePlayed(perc: number) {
    this._filter.sourcePosition = Math.floor(
      perc * this.duration * this.sampleRate,
    );
    this.sourcePosition = this._filter.sourcePosition;
    this.timePlayed = this.sourcePosition / this.sampleRate;
  }

  /**
   * Returns the ScriptProcessorNode for audio output.
   */
  get node(): ScriptProcessorNode {
    return this._node;
  }

  /**
   * Sets pitch factor.
   * @param pitch Pitch factor.
   */
  set pitch(pitch: number) {
    this._soundtouch.pitch = pitch;
  }

  /**
   * Sets pitch in semitones.
   * @param semitone Pitch semitones.
   */
  set pitchSemitones(semitone: number) {
    this._soundtouch.pitchSemitones = semitone;
  }

  /**
   * Sets playback rate.
   * @param rate Rate factor.
   */
  set rate(rate: number) {
    this._soundtouch.rate = rate;
  }

  /**
   * Sets playback tempo.
   * @param tempo Tempo factor.
   */
  set tempo(tempo: number) {
    this._soundtouch.tempo = tempo;
  }

  /**
   * Connects the ScriptProcessorNode to another AudioNode.
   * @param toNode Destination AudioNode.
   */
  connect(toNode: AudioNode): void {
    this._node.connect(toNode);
  }

  /**
   * Disconnects the ScriptProcessorNode from its destination.
   */
  disconnect(): void {
    this._node.disconnect();
  }

  /**
   * Registers an event listener for custom playback events.
   * @param eventName Event name (e.g. 'play').
   * @param cb Callback for event detail.
   */
  on(eventName: string, cb: (detail: PlayEventDetail) => void): void {
    this.listeners.push({ name: eventName, cb });
    this._node.addEventListener(eventName, ((
      event: CustomEvent<PlayEventDetail>,
    ) => cb(event.detail)) as EventListener_2);
  }

  /**
   * Removes event listeners for custom playback events.
   * @param eventName Event name to remove (or all if null).
   */
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
