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

/**
 * Abstract base class for sample processing pipes.
 * Provides common buffer management for audio processing.
 *
 * @remarks
 * This class manages input and output buffers for audio sample processing.
 * Subclasses should implement specific processing logic.
 */
export default class AbstractFifoSamplePipe {
  /**
   * Input buffer for audio samples.
   */
  protected _inputBuffer: FifoSampleBuffer | null;

  /**
   * Output buffer for processed audio samples.
   */
  protected _outputBuffer: FifoSampleBuffer | null;

  /**
   * Constructs an AbstractFifoSamplePipe.
   * @param createBuffers If true, initializes input and output buffers.
   */
  constructor(createBuffers?: boolean) {
    if (createBuffers) {
      this._inputBuffer = new FifoSampleBuffer();
      this._outputBuffer = new FifoSampleBuffer();
    } else {
      this._inputBuffer = null;
      this._outputBuffer = null;
    }
  }

  /**
   * Gets the input buffer.
   */
  get inputBuffer(): FifoSampleBuffer | null {
    return this._inputBuffer;
  }

  /**
   * Sets the input buffer.
   */
  set inputBuffer(inputBuffer: FifoSampleBuffer | null) {
    this._inputBuffer = inputBuffer;
  }

  /**
   * Gets the output buffer.
   */
  get outputBuffer(): FifoSampleBuffer | null {
    return this._outputBuffer;
  }

  /**
   * Sets the output buffer.
   */
  set outputBuffer(outputBuffer: FifoSampleBuffer | null) {
    this._outputBuffer = outputBuffer;
  }

  /**
   * Clears both input and output buffers.
   */
  clear(): void {
    this._inputBuffer?.clear();
    this._outputBuffer?.clear();
  }
}
