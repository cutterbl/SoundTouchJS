/*
 * SoundTouch JS audio processing library
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

import type {
  RateTransposerInterpolationStrategy,
  SampleBufferType,
  StretchParameters,
} from '@soundtouchjs/core';
import { SoundTouchNode } from './SoundTouchNode.js';

/**
 * Options for `processOffline`.
 *
 * @remarks
 * All audio transform parameters are optional and default to their neutral values
 * (`pitch: 1.0`, `pitchSemitones: 0`, `playbackRate: 1.0`).
 */
export interface ProcessOfflineOptions {
  /**
   * The source audio buffer to process.
   */
  input: AudioBuffer;

  /**
   * URL or path to the SoundTouch processor script, passed to `SoundTouchNode.register`.
   */
  processorUrl: string | URL;

  /**
   * Pitch multiplier (1.0 = original pitch).
   * @defaultValue 1.0
   */
  pitch?: number;

  /**
   * Pitch shift in semitones, combined with `pitch`.
   * @defaultValue 0
   */
  pitchSemitones?: number;

  /**
   * Playback rate multiplier. Output length is scaled by `1 / playbackRate`.
   * @defaultValue 1.0
   */
  playbackRate?: number;

  /**
   * Interpolation strategy to use in the rate transposer.
   */
  interpolationStrategy?: RateTransposerInterpolationStrategy;

  /**
   * WSOLA timing parameters to apply to the stretch stage.
   */
  stretchParameters?: StretchParameters;

  /**
   * Internal sample buffer strategy.
   */
  sampleBufferType?: SampleBufferType;
}

/**
 * Renders audio through SoundTouch processing in an `OfflineAudioContext`.
 *
 * @remarks
 * Creates an `OfflineAudioContext`, registers the processor module, builds the
 * audio graph, applies all transform parameters, and returns the rendered
 * `AudioBuffer`. The output length is estimated as
 * `ceil(input.length / playbackRate)` to account for tempo changes.
 *
 * @param options Processing options including the input buffer and processor URL.
 * @returns A Promise that resolves to the processed `AudioBuffer`.
 *
 * @example
 * ```ts
 * import { processOffline } from '@soundtouchjs/audio-worklet';
 *
 * const processed = await processOffline({
 *   input: audioBuffer,
 *   processorUrl: '/soundtouch-processor.js',
 *   pitchSemitones: -3,
 *   playbackRate: 1.2,
 * });
 * ```
 */
export async function processOffline(
  options: ProcessOfflineOptions,
): Promise<AudioBuffer> {
  const {
    input,
    processorUrl,
    pitch = 1.0,
    pitchSemitones = 0,
    playbackRate = 1.0,
    interpolationStrategy,
    stretchParameters,
    sampleBufferType,
  } = options;

  const outputLength = Math.ceil(input.length / playbackRate);

  const offlineCtx = new OfflineAudioContext(
    input.numberOfChannels,
    outputLength,
    input.sampleRate,
  );

  await SoundTouchNode.register(offlineCtx, processorUrl);

  const stNode = new SoundTouchNode({
    context: offlineCtx,
    interpolationStrategy,
    sampleBufferType,
  });

  stNode.pitch.value = pitch;
  stNode.pitchSemitones.value = pitchSemitones;
  stNode.playbackRate.value = playbackRate;

  if (stretchParameters) {
    stNode.setStretchParameters(stretchParameters);
  }

  stNode.connect(offlineCtx.destination);

  const source = offlineCtx.createBufferSource();
  source.buffer = input;
  source.playbackRate.value = playbackRate;
  source.connect(stNode);
  source.start(0);

  return offlineCtx.startRendering();
}
