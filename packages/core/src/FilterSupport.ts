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
 * version 3 of the License.
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

import type { SampleBuffer } from './SampleBuffer.js';

/**
 * Interface for sample processing pipes.
 *
 * @remarks
 * Defines the contract for audio processing stages that operate on input and output sample buffers.
 * Used for chaining together multiple processing steps in an audio pipeline.
 */
export interface SamplePipe {
  /**
   * Input buffer for audio samples.
   */
  readonly inputBuffer: SampleBuffer | null;

  /**
   * Output buffer for processed audio samples.
   */
  readonly outputBuffer: SampleBuffer | null;

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
 *
 * @remarks
 * Wraps a SamplePipe and provides buffer fill and clear logic for audio processing chains.
 * Used for chaining together multiple audio processing steps, managing buffer filling and clearing.
 */
export default class FilterSupport {
  /**
   * The wrapped sample processing pipe.
   * @remarks
   * The underlying processing stage that this filter supports and manages.
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
   * @returns The wrapped SamplePipe instance.
   */
  get pipe(): SamplePipe {
    return this._pipe;
  }

  /**
   * Returns the input buffer from the wrapped pipe.
   * @returns The input SampleBuffer, or null if not set.
   */
  get inputBuffer(): SampleBuffer | null {
    return this._pipe.inputBuffer;
  }

  /**
   * Returns the output buffer from the wrapped pipe.
   * @returns The output SampleBuffer, or null if not set.
   */
  get outputBuffer(): SampleBuffer | null {
    return this._pipe.outputBuffer;
  }

  /**
   * Fills the input buffer with the specified number of frames.
   *
   * @param _numFrames Number of frames to fill.
   * @throws Error if not overridden.
   * @remarks
   * Subclasses should override this method to provide custom logic for filling the input buffer.
   */
  fillInputBuffer(_numFrames: number): void {
    throw new Error('fillInputBuffer() not overridden');
  }

  /**
   * Fills the output buffer with at least numFrames.
   *
   * @param numFrames Minimum number of frames to fill.
   * @remarks
   * Calls fillInputBuffer and process as needed to ensure the output buffer contains at least the requested number of frames.
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
   * @remarks
   * Calls the clear method on the wrapped SamplePipe to reset its state.
   */
  clear(): void {
    this._pipe.clear();
  }
}
