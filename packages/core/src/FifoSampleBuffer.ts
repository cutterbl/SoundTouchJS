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

const BYTES_PER_SAMPLE = 4;
const SAMPLES_PER_FRAME = 2;
const BYTES_PER_FRAME = BYTES_PER_SAMPLE * SAMPLES_PER_FRAME;
const DEFAULT_MAX_FRAMES = 131072;

export default class FifoSampleBuffer {
  private _buffer: ArrayBuffer;
  private _vector: Float32Array;
  private _position: number;
  private _frameCount: number;

  constructor(maxFrames = DEFAULT_MAX_FRAMES) {
    this._buffer = new ArrayBuffer(0, {
      maxByteLength: maxFrames * BYTES_PER_FRAME,
    });
    this._vector = new Float32Array(this._buffer);
    this._position = 0;
    this._frameCount = 0;
  }

  get vector(): Float32Array {
    return this._vector;
  }

  get position(): number {
    return this._position;
  }

  get startIndex(): number {
    return this._position * 2;
  }

  get frameCount(): number {
    return this._frameCount;
  }

  get endIndex(): number {
    return (this._position + this._frameCount) * 2;
  }

  clear(): void {
    this._vector.fill(0);
    this._position = 0;
    this._frameCount = 0;
  }

  put(numFrames: number): void {
    this._frameCount += numFrames;
  }

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

  putBuffer(buffer: FifoSampleBuffer, position = 0, numFrames = 0): void {
    if (!(numFrames >= 0) || numFrames === 0) {
      numFrames = buffer.frameCount - position;
    }
    this.putSamples(buffer.vector, buffer.position + position, numFrames);
  }

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

  receiveSamples(output: Float32Array, numFrames = 0): void {
    const numSamples = numFrames * 2;
    const sourceOffset = this.startIndex;
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
    this.receive(numFrames);
  }

  extract(output: Float32Array, position = 0, numFrames = 0): void {
    const sourceOffset = this.startIndex + position * 2;
    const numSamples = numFrames * 2;
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
  }

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

  ensureAdditionalCapacity(numFrames = 0): void {
    this.ensureCapacity(this._frameCount + numFrames);
  }

  rewind(): void {
    if (this._position > 0) {
      this._vector.set(this._vector.subarray(this.startIndex, this.endIndex));
      this._position = 0;
    }
  }
}
