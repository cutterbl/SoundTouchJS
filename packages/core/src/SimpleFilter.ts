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

import FilterSupport from './FilterSupport.js';
import type { SamplePipe } from './FilterSupport.js';
import noop from './noop.js';

interface SimpleFilterSourceSound {
  extract(target: Float32Array, numFrames: number, position: number): number;
}

export interface SimpleFilterConstructorOptions {
  /** Source object with extract method. */
  sourceSound: SimpleFilterSourceSound;
  /** SoundTouch or other SamplePipe. */
  pipe: SamplePipe;
  /** Optional callback for end of playback. */
  callback?: () => void;
}

/**
 * Pulls samples through a SoundTouch pipe from a source.
 *
 * @remarks
 * Used internally for real-time processing and playback. This class manages the flow of audio data from a source object through a SoundTouch processing pipe, handling buffer management and playback position.
 */
export default class SimpleFilter extends FilterSupport {
  private callback: () => void;
  private sourceSound: SimpleFilterSourceSound;
  private historyBufferSize: number;
  private _sourcePosition: number;
  private outputBufferPosition: number;
  private _position: number;
  private _scratchBuffer: Float32Array;

  /**
   * Creates a SimpleFilter instance.
   * @param options Constructor options.
   */
  constructor({
    sourceSound,
    pipe,
    callback = noop,
  }: SimpleFilterConstructorOptions) {
    super(pipe);
    this.callback = callback;
    this.sourceSound = sourceSound;
    this.historyBufferSize = 22050;
    this._sourcePosition = 0;
    this.outputBufferPosition = 0;
    this._position = 0;
    this._scratchBuffer = new Float32Array(0);
  }

  /**
   * Current playback position in output frames.
   * @returns The current output frame position.
   */
  get position(): number {
    return this._position;
  }

  /**
   * Sets the playback position in output frames.
   * @param position The new output frame position.
   * @throws RangeError if the new position is invalid.
   */
  set position(position: number) {
    if (position > this._position) {
      throw new RangeError(
        'New position may not be greater than current position',
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

  /**
   * Current source position in input frames.
   * @returns The current input frame position in the source.
   */
  get sourcePosition(): number {
    return this._sourcePosition;
  }

  /**
   * Sets the source position in input frames.
   * @param sourcePosition The new input frame position in the source.
   * @remarks
   * Resets internal buffers and state when changed.
   */
  set sourcePosition(sourcePosition: number) {
    this.clear();
    this._sourcePosition = sourcePosition;
  }

  /**
   * Invokes the end-of-playback callback, if provided.
   */
  onEnd(): void {
    this.callback();
  }

  /**
   * Fills the input buffer with frames extracted from the source.
   * @param numFrames Number of frames to fill.
   */
  override fillInputBuffer(numFrames = 0): void {
    const needed = numFrames * 2;
    if (this._scratchBuffer.length < needed) {
      this._scratchBuffer = new Float32Array(needed);
    }
    const numFramesExtracted = this.sourceSound.extract(
      this._scratchBuffer,
      numFrames,
      this._sourcePosition,
    );
    this._sourcePosition += numFramesExtracted;
    this.inputBuffer!.putSamples(this._scratchBuffer, 0, numFramesExtracted);
  }

  /**
   * Extracts processed frames from the output buffer into the target array.
   * @param target Destination array for interleaved stereo samples.
   * @param numFrames Number of frames to extract.
   * @returns The number of frames actually extracted.
   */
  extract(target: Float32Array, numFrames = 0): number {
    this.fillOutputBuffer(this.outputBufferPosition + numFrames);

    const numFramesExtracted = Math.min(
      numFrames,
      this.outputBuffer!.frameCount - this.outputBufferPosition,
    );
    this.outputBuffer!.extract(
      target,
      this.outputBufferPosition,
      numFramesExtracted,
    );

    const currentFrames = this.outputBufferPosition + numFramesExtracted;
    this.outputBufferPosition = Math.min(this.historyBufferSize, currentFrames);
    this.outputBuffer!.receive(
      Math.max(currentFrames - this.historyBufferSize, 0),
    );

    this._position += numFramesExtracted;
    return numFramesExtracted;
  }

  /**
   * Handles sample data events by extracting frames into the event's data buffer.
   * @param event Object containing a Float32Array to fill with audio data.
   */
  handleSampleData(event: { data: Float32Array }): void {
    this.extract(event.data, 4096);
  }

  /**
   * Clears internal state and resets the output buffer position.
   */
  override clear(): void {
    super.clear();
    this.outputBufferPosition = 0;
  }
}
