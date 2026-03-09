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

export interface SamplePipe {
  readonly inputBuffer: FifoSampleBuffer | null;
  readonly outputBuffer: FifoSampleBuffer | null;
  process(): void;
  clear(): void;
}

export default class FilterSupport {
  protected _pipe: SamplePipe;

  constructor(pipe: SamplePipe) {
    this._pipe = pipe;
  }

  get pipe(): SamplePipe {
    return this._pipe;
  }

  get inputBuffer(): FifoSampleBuffer | null {
    return this._pipe.inputBuffer;
  }

  get outputBuffer(): FifoSampleBuffer | null {
    return this._pipe.outputBuffer;
  }

  fillInputBuffer(_numFrames: number): void {
    throw new Error('fillInputBuffer() not overridden');
  }

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

  clear(): void {
    this._pipe.clear();
  }
}
