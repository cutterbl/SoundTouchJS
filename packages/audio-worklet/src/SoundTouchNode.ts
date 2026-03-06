/*
 * SoundTouch JS audio processing library
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

import { PROCESSOR_NAME } from './constants.js';

export interface SoundTouchNodeOptions {
  processorUrl?: string | URL;
}

export class SoundTouchNode extends AudioWorkletNode {
  static readonly processorName = PROCESSOR_NAME;

  static async register(
    context: BaseAudioContext,
    processorUrl: string | URL,
  ): Promise<void> {
    await context.audioWorklet.addModule(processorUrl);
  }

  constructor(context: BaseAudioContext) {
    super(context, PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
  }

  get pitch(): AudioParam {
    return this.parameters.get('pitch')!;
  }

  get tempo(): AudioParam {
    return this.parameters.get('tempo')!;
  }

  get rate(): AudioParam {
    return this.parameters.get('rate')!;
  }

  get pitchSemitones(): AudioParam {
    return this.parameters.get('pitchSemitones')!;
  }
}
