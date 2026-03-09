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

/**
 * Main-thread AudioWorkletNode wrapper for SoundTouch audio processing.
 * Provides AudioParam accessors for pitch, tempo, rate, pitchSemitones, and playbackRate.
 *
 * @example
 * const stNode = new SoundTouchNode(audioCtx);
 * stNode.pitch.value = 1.2;
 * stNode.tempo.value = 0.8;
 * stNode.pitchSemitones.value = -3;
 */
export class SoundTouchNode extends AudioWorkletNode {
  static readonly processorName = PROCESSOR_NAME;

  /**
   * Registers the SoundTouch processor module with the given AudioContext.
   * Must be called before creating SoundTouchNode instances.
   *
   * @param context - The AudioContext or OfflineAudioContext
   * @param processorUrl - URL or path to the processor script
   */
  static async register(
    context: BaseAudioContext,
    processorUrl: string | URL,
  ): Promise<void> {
    await context.audioWorklet.addModule(processorUrl);
  }

  /**
   * Creates a SoundTouchNode instance.
   * @param context - The AudioContext or OfflineAudioContext
   */
  constructor(context: BaseAudioContext) {
    super(context, PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
  }

  /**
   * Pitch multiplier AudioParam (1.0 = original pitch).
   */
  get pitch(): AudioParam {
    return this.parameters.get('pitch')!;
  }

  /**
   * Tempo multiplier AudioParam (1.0 = original tempo).
   */
  get tempo(): AudioParam {
    return this.parameters.get('tempo')!;
  }

  /**
   * Rate multiplier AudioParam (affects both pitch and tempo).
   */
  get rate(): AudioParam {
    return this.parameters.get('rate')!;
  }

  /**
   * Pitch shift in semitones AudioParam (integer steps for musical key changes).
   */
  get pitchSemitones(): AudioParam {
    return this.parameters.get('pitchSemitones')!;
  }

  get playbackRate(): AudioParam {
    return this.parameters.get('playbackRate')!;
  }
}
