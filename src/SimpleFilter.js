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

import FilterSupport from './FilterSupport';
import noop from './noop';

export default class SimpleFilter extends FilterSupport {
  constructor(sourceSound, pipe, callback = noop) {
    super(pipe);
    this.callback = callback;
    this.sourceSound = sourceSound;
    //this.bufferDuration = sourceSound.buffer.duration;
    this.historyBufferSize = 22050;
    this._sourcePosition = 0;
    this.outputBufferPosition = 0;
    this._position = 0;
  }

  get position() {
    return this._position;
  }

  set position(position) {
    if (position > this._position) {
      throw new RangeError(
        'New position may not be greater than current position'
      );
    }
    const newOutputBufferPosition =
      this.outputBufferPosition - (this._position - position);
    if (newOutputBufferPosition < 0) {
      throw new RangeError('New position falls outside of history buffer');
    }
    this.outputBufferPosition = newOutputBufferPosition;
    this._position = position;
  }

  get sourcePosition() {
    return this._sourcePosition;
  }

  set sourcePosition(sourcePosition) {
    this.clear();
    this._sourcePosition = sourcePosition;
  }

  onEnd() {
    this.callback();
  }

  fillInputBuffer(numFrames = 0) {
    const samples = new Float32Array(numFrames * 2);
    const numFramesExtracted = this.sourceSound.extract(
      samples,
      numFrames,
      this._sourcePosition
    );
    this._sourcePosition += numFramesExtracted;
    this.inputBuffer.putSamples(samples, 0, numFramesExtracted);
  }

  extract(target, numFrames = 0) {
    this.fillOutputBuffer(this.outputBufferPosition + numFrames);

    const numFramesExtracted = Math.min(
      numFrames,
      this.outputBuffer.frameCount - this.outputBufferPosition
    );
    this.outputBuffer.extract(
      target,
      this.outputBufferPosition,
      numFramesExtracted
    );

    const currentFrames = this.outputBufferPosition + numFramesExtracted;
    this.outputBufferPosition = Math.min(this.historyBufferSize, currentFrames);
    this.outputBuffer.receive(
      Math.max(currentFrames - this.historyBufferSize, 0)
    );

    this._position += numFramesExtracted;
    return numFramesExtracted;
  }

  handleSampleData(event) {
    this.extract(event.data, 4096);
  }

  clear() {
    super.clear();
    this.outputBufferPosition = 0;
  }
}
