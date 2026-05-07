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

export interface AbstractSamplePipeOptions<
  TInputBuffer extends SampleBuffer,
  TOutputBuffer extends SampleBuffer,
> {
  /** If true, initializes input and output buffers. */
  createBuffers?: boolean;
  /** Factory used to create input buffer instances. */
  inputBufferFactory?: () => TInputBuffer;
  /** Factory used to create output buffer instances. */
  outputBufferFactory?: () => TOutputBuffer;
}

/**
 * Abstract base class for sample processing pipes.
 * Provides common buffer management for audio processing.
 *
 * @remarks
 * This class manages input and output buffers for audio sample processing.
 * Subclasses should implement specific processing logic.
 *
 * @typeParam TInputBuffer Concrete input buffer type.
 * Defaults to the generic `SampleBuffer` contract.
 * @typeParam TOutputBuffer Concrete output buffer type.
 * Defaults to `TInputBuffer` so input/output share the same buffer type unless
 * a subclass opts into different types.
 */
export default class AbstractSamplePipe<
  TInputBuffer extends SampleBuffer = SampleBuffer,
  TOutputBuffer extends SampleBuffer = TInputBuffer,
> {
  /**
   * Input buffer for audio samples.
   */
  protected _inputBuffer: TInputBuffer | null;

  /**
   * Output buffer for processed audio samples.
   */
  protected _outputBuffer: TOutputBuffer | null;

  /**
   * Constructs an AbstractSamplePipe.
   * @param options Constructor options.
   *
   * @remarks
   * When `createBuffers` is true, both factories are required so subclasses can
   * control exact buffer implementations without unsafe casting.
   */
  constructor({
    createBuffers = false,
    inputBufferFactory,
    outputBufferFactory,
  }: AbstractSamplePipeOptions<TInputBuffer, TOutputBuffer> = {}) {
    if (createBuffers) {
      if (!inputBufferFactory || !outputBufferFactory) {
        throw new Error(
          'buffer factories are required when createBuffers is true',
        );
      }
      this._inputBuffer = inputBufferFactory();
      this._outputBuffer = outputBufferFactory();
    } else {
      this._inputBuffer = null;
      this._outputBuffer = null;
    }
  }

  /**
   * Gets the input buffer.
   */
  get inputBuffer(): TInputBuffer | null {
    return this._inputBuffer;
  }

  /**
   * Sets the input buffer.
   */
  set inputBuffer(inputBuffer: TInputBuffer | null) {
    this._inputBuffer = inputBuffer;
  }

  /**
   * Gets the output buffer.
   */
  get outputBuffer(): TOutputBuffer | null {
    return this._outputBuffer;
  }

  /**
   * Sets the output buffer.
   */
  set outputBuffer(outputBuffer: TOutputBuffer | null) {
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
