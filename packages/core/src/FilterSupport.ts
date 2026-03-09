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

import type FifoSampleBuffer from './FifoSampleBuffer.js';

/**
 * Interface for sample processing pipes.
 * Defines input/output buffers and processing methods.
 */
export interface SamplePipe {
  /**
   * Input buffer for audio samples.
   */
  readonly inputBuffer: FifoSampleBuffer | null;

  /**
   * Output buffer for processed audio samples.
   */
  readonly outputBuffer: FifoSampleBuffer | null;

  /**
   * Processes samples from input to output buffer.
   */
  process(): void;

  /**
   * Clears internal buffers and state.
   */
  clear(): void;
}

/**
 * Base class for filter pipes, providing process and clear methods.
 * Used for chaining sample processing steps.
 *
 * @remarks
 * Wraps a SamplePipe and provides buffer fill and clear logic for audio processing chains.
 */
export default class FilterSupport {
  /**
   * The wrapped sample processing pipe.
   */
  protected _pipe: SamplePipe;

  /**
   * Constructs a FilterSupport instance.
   * @param pipe The sample processing pipe to wrap.
   */
  constructor(pipe: SamplePipe) {
    this._pipe = pipe;
  }

  /**
   * Returns the wrapped sample pipe.
   */
  get pipe(): SamplePipe {
    return this._pipe;
  }

  /**
   * Returns the input buffer from the wrapped pipe.
   */
  get inputBuffer(): FifoSampleBuffer | null {
    return this._pipe.inputBuffer;
  }

  /**
   * Returns the output buffer from the wrapped pipe.
   */
  get outputBuffer(): FifoSampleBuffer | null {
    return this._pipe.outputBuffer;
  }

  /**
   * Fills the input buffer with the specified number of frames.
   * Should be overridden by subclasses.
   * @param _numFrames Number of frames to fill.
   * @throws Error if not overridden.
   */
  fillInputBuffer(_numFrames: number): void {
    throw new Error('fillInputBuffer() not overridden');
  }

  /**
   * Fills the output buffer with at least numFrames.
   * Calls fillInputBuffer and process as needed.
   * @param numFrames Minimum number of frames to fill.
   */
  fillOutputBuffer(numFrames = 0): void {
    while (this.outputBuffer!.frameCount < numFrames) {
      const numInputFrames = 8192 * 2 - this.inputBuffer!.frameCount;

      this.fillInputBuffer(numInputFrames);

      if (this.inputBuffer!.frameCount < 8192 * 2) {
        break;
      }
      this._pipe.process();
    }
  }

  /**
   * Clears the wrapped pipe's buffers and state.
   */
  clear(): void {
    this._pipe.clear();
  }
}
