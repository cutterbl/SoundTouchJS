/*
 * SoundTouch JS audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 * Copyright (c) Jakub Fiala
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Number of bytes per sample (Float32).
 */
const BYTES_PER_SAMPLE = 4;

/**
 * Number of samples per audio frame (stereo).
 */
const SAMPLES_PER_FRAME = 2;

/**
 * Number of bytes per audio frame.
 */
const BYTES_PER_FRAME = BYTES_PER_SAMPLE * SAMPLES_PER_FRAME;

/**
 * Default maximum number of frames for buffer allocation.
 */
const DEFAULT_MAX_FRAMES = 131072;

/**
 * Resizable interleaved sample buffer for audio processing.
 *
 * @remarks
 * Stores stereo audio samples in a contiguous Float32Array and provides methods for efficient buffer management and sample transfer.
 * Uses ES2024 ArrayBuffer for zero-allocation growth. Suitable for scenarios where buffer size may need to grow dynamically during audio processing.
 */
export default class FifoSampleBuffer {
  /**
   * Backing ArrayBuffer for sample storage.
   * @remarks
   * Underlying memory for the buffer, which may be resized as needed.
   */
  private _buffer: ArrayBuffer;

  /**
   * Float32Array view of the buffer.
   * @remarks
   * Provides direct access to the sample data for reading and writing.
   */
  private _vector: Float32Array;

  /**
   * Current read position (frame index).
   * @remarks
   * Indicates the logical start of readable data within the buffer.
   */
  private _position: number;

  /**
   * Number of frames currently stored.
   * @remarks
   * Represents the number of complete stereo frames available for reading.
   */
  private _frameCount: number;

  /**
   * Creates a new FifoSampleBuffer.
   * @param maxFrames Maximum number of frames for buffer allocation.
   */
  constructor(maxFrames = DEFAULT_MAX_FRAMES) {
    this._buffer = new ArrayBuffer(0, {
      maxByteLength: maxFrames * BYTES_PER_FRAME,
    });
    this._vector = new Float32Array(this._buffer);
    this._position = 0;
    this._frameCount = 0;
  }

  /**
   * Returns the Float32Array view of the buffer.
   * @returns The Float32Array containing the sample data.
   */
  get vector(): Float32Array {
    return this._vector;
  }

  /**
   * Returns the current read position (frame index).
   * @returns The current frame index for reading.
   */
  get position(): number {
    return this._position;
  }

  /**
   * Returns the start sample index for reading.
   * @returns The sample index corresponding to the start of readable data.
   */
  get startIndex(): number {
    return this._position * 2;
  }

  /**
   * Returns the number of frames currently stored.
   * @returns The number of complete frames available for reading.
   */
  get frameCount(): number {
    return this._frameCount;
  }

  /**
   * Returns the end sample index for reading.
   * @returns The sample index corresponding to the end of readable data.
   */
  get endIndex(): number {
    return (this._position + this._frameCount) * 2;
  }

  /**
   * Clears the buffer and resets position and frame count.
   * @remarks
   * Fills the buffer with zeros and resets all internal state.
   */
  clear(): void {
    this._vector.fill(0);
    this._position = 0;
    this._frameCount = 0;
  }

  /**
   * Adds empty frames to the buffer.
   * @param numFrames Number of frames to add.
   */
  put(numFrames: number): void {
    this._frameCount += numFrames;
  }

  /**
   * Adds samples to the buffer from a Float32Array.
   * @param samples Source samples (interleaved stereo).
   * @param position Start frame index in source.
   * @param numFrames Number of frames to copy (default: all available).
   * @remarks
   * Automatically grows the buffer if needed. Only complete frames are appended.
   */
  putSamples(samples: Float32Array, position = 0, numFrames = 0): void {
    const sourceOffset = position * 2;
    if (!(numFrames >= 0) || numFrames === 0) {
      numFrames = (samples.length - sourceOffset) / 2;
    }
    const numSamples = numFrames * 2;

    this.ensureCapacity(numFrames + this._frameCount);

    const destOffset = this.endIndex;
    this._vector.set(
      samples.subarray(sourceOffset, sourceOffset + numSamples),
      destOffset,
    );

    this._frameCount += numFrames;
  }

  /**
   * Adds samples from another FifoSampleBuffer.
   * @param buffer Source buffer.
   * @param position Start frame index in source buffer.
   * @param numFrames Number of frames to copy (default: all available).
   */
  putBuffer(buffer: FifoSampleBuffer, position = 0, numFrames = 0): void {
    if (!(numFrames >= 0) || numFrames === 0) {
      numFrames = buffer.frameCount - position;
    }
    this.putSamples(buffer.vector, buffer.position + position, numFrames);
  }

  /**
   * Advances the read position and reduces frame count.
   * @param numFrames Number of frames to receive (default: all available).
   * @remarks
   * Consumed frames are no longer available for reading.
   */
  receive(numFrames?: number): void {
    if (
      numFrames === undefined ||
      !(numFrames >= 0) ||
      numFrames > this._frameCount
    ) {
      numFrames = this._frameCount;
    }
    this._frameCount -= numFrames;
    this._position += numFrames;
  }

  /**
   * Copies and receives samples into an output array.
   * @param output Destination Float32Array.
   * @param numFrames Number of frames to copy and receive.
   * @remarks
   * Advances the read position after copying.
   */
  receiveSamples(output: Float32Array, numFrames = 0): void {
    const numSamples = numFrames * 2;
    const sourceOffset = this.startIndex;
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
    this.receive(numFrames);
  }

  /**
   * Extracts samples into an output array without advancing position.
   * @param output Destination Float32Array.
   * @param position Start frame index in buffer.
   * @param numFrames Number of frames to extract.
   */
  extract(output: Float32Array, position = 0, numFrames = 0): void {
    const sourceOffset = this.startIndex + position * 2;
    const numSamples = numFrames * 2;
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
  }

  /**
   * Ensures the buffer has capacity for at least numFrames.
   * @param numFrames Minimum number of frames required.
   * @remarks
   * Grows the buffer if needed, preserving all readable frames in order.
   */
  ensureCapacity(numFrames = 0): void {
    const minLength = Math.floor(numFrames * SAMPLES_PER_FRAME);
    if (this._vector.length < minLength) {
      const newByteLength = minLength * BYTES_PER_SAMPLE;
      if (newByteLength <= this._buffer.maxByteLength) {
        this.rewind();
        this._buffer.resize(newByteLength);
        this._vector = new Float32Array(this._buffer);
      } else {
        const newMaxBytes = newByteLength * 2;
        const newBuffer = new ArrayBuffer(newByteLength, {
          maxByteLength: newMaxBytes,
        });
        const newVector = new Float32Array(newBuffer);
        newVector.set(this._vector.subarray(this.startIndex, this.endIndex));
        this._buffer = newBuffer;
        this._vector = newVector;
        this._position = 0;
      }
    } else {
      this.rewind();
    }
  }

  /**
   * Ensures buffer has capacity for additional frames.
   * @param numFrames Number of additional frames required.
   */
  ensureAdditionalCapacity(numFrames = 0): void {
    this.ensureCapacity(this._frameCount + numFrames);
  }

  /**
   * Moves all unread samples to the start of the buffer.
   * @remarks
   * Compacts the buffer so that all unread samples are at the beginning, freeing space for new data.
   */
  rewind(): void {
    if (this._position > 0) {
      this._vector.set(this._vector.subarray(this.startIndex, this.endIndex));
      this._position = 0;
    }
  }
}
