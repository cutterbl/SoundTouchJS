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

import AbstractFifoSamplePipe from './AbstractFifoSamplePipe.js';

export default class RateTransposer extends AbstractFifoSamplePipe {
  private _rate: number;
  private slopeCount: number;
  private prevSampleL: number;
  private prevSampleR: number;

  constructor(createBuffers?: boolean) {
    super(createBuffers);
    this.slopeCount = 0;
    this.prevSampleL = 0;
    this.prevSampleR = 0;
    this._rate = 1;
  }

  set rate(rate: number) {
    this._rate = rate;
  }

  private reset(): void {
    this.slopeCount = 0;
    this.prevSampleL = 0;
    this.prevSampleR = 0;
  }

  override clear(): void {
    super.clear();
    this.reset();
  }

  clone(): RateTransposer {
    const result = new RateTransposer();
    result.rate = this._rate;
    return result;
  }

  process(): void {
    const numFrames = this._inputBuffer!.frameCount;
    this._outputBuffer!.ensureAdditionalCapacity(numFrames / this._rate + 1);
    const numFramesOutput = this.transpose(numFrames);
    this._inputBuffer!.receive();
    this._outputBuffer!.put(numFramesOutput);
  }

  transpose(numFrames = 0): number {
    if (numFrames === 0) {
      return 0;
    }

    const src = this._inputBuffer!.vector;
    const srcOffset = this._inputBuffer!.startIndex;

    const dest = this._outputBuffer!.vector;
    const destOffset = this._outputBuffer!.endIndex;

    let used = 0;
    let i = 0;

    while (this.slopeCount < 1.0) {
      dest[destOffset + 2 * i] =
        (1.0 - this.slopeCount) * this.prevSampleL +
        this.slopeCount * src[srcOffset];
      dest[destOffset + 2 * i + 1] =
        (1.0 - this.slopeCount) * this.prevSampleR +
        this.slopeCount * src[srcOffset + 1];
      i = i + 1;
      this.slopeCount += this._rate;
    }

    this.slopeCount -= 1.0;

    if (numFrames !== 1) {
      // eslint-disable-next-line no-constant-condition
      out: while (true) {
        while (this.slopeCount > 1.0) {
          this.slopeCount -= 1.0;
          used = used + 1;
          if (used >= numFrames - 1) {
            break out;
          }
        }

        const srcIndex = srcOffset + 2 * used;
        dest[destOffset + 2 * i] =
          (1.0 - this.slopeCount) * src[srcIndex] +
          this.slopeCount * src[srcIndex + 2];
        dest[destOffset + 2 * i + 1] =
          (1.0 - this.slopeCount) * src[srcIndex + 1] +
          this.slopeCount * src[srcIndex + 3];

        i = i + 1;
        this.slopeCount += this._rate;
      }
    }

    this.prevSampleL = src[srcOffset + 2 * numFrames - 2];
    this.prevSampleR = src[srcOffset + 2 * numFrames - 1];

    return i;
  }
}
