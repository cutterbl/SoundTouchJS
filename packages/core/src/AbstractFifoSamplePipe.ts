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

import FifoSampleBuffer from './FifoSampleBuffer.js';

export default class AbstractFifoSamplePipe {
  protected _inputBuffer: FifoSampleBuffer | null;
  protected _outputBuffer: FifoSampleBuffer | null;

  constructor(createBuffers?: boolean) {
    if (createBuffers) {
      this._inputBuffer = new FifoSampleBuffer();
      this._outputBuffer = new FifoSampleBuffer();
    } else {
      this._inputBuffer = null;
      this._outputBuffer = null;
    }
  }

  get inputBuffer(): FifoSampleBuffer | null {
    return this._inputBuffer;
  }

  set inputBuffer(inputBuffer: FifoSampleBuffer | null) {
    this._inputBuffer = inputBuffer;
  }

  get outputBuffer(): FifoSampleBuffer | null {
    return this._outputBuffer;
  }

  set outputBuffer(outputBuffer: FifoSampleBuffer | null) {
    this._outputBuffer = outputBuffer;
  }

  clear(): void {
    this._inputBuffer?.clear();
    this._outputBuffer?.clear();
  }
}
