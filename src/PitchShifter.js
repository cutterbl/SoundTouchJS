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

export default class PitchShifter {
    constructor(context, buffer, bufferSize, onEnd = noop) {
        this._soundtouch = new SoundTouch();
        const source = new WebAudioBufferSource(buffer);
        this._filter = new SimpleFilter(source, this._soundtouch, onEnd);
        this._node = getWebAudioNode(context, this._filter);
        this.tempo = 1;
        this.rate = 1;
        this.duration = () => buffer.duration;
        this.sampleRate = () => context.sampleRate;
    }

    get formattedDuration() {
        const dur = this.duration() || 0;
        return minsSecs(dur);
    }

    get formattedTimePlayed() {
        return minsSecs(this.timePlayed);
    }

    get timePlayed() {
        return this._filter.sourcePosition / this.sampleRate();
    }

    get sourcePosition() {
        return this._filter.sourcePosition;
    }

    get percentagePlayed() {
        const dur = this.duration() || 0;
        return (100 * this._filter.sourcePosition / (dur * this.sampleRate()));
    }

    set percentagePlayed(perc) {
        const dur = this.duration() || 0;
        this._filter.sourcePosition = parseInt(perc * dur * this.sampleRate());
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
}