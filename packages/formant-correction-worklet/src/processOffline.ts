/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
  RateTransposerInterpolationStrategy,
  SampleBufferType,
  StretchParameters,
} from '@soundtouchjs/core';
import { FormantCorrectionNode } from './FormantCorrectionNode.js';

/**
 * Options for offline rendering with `FormantCorrectionNode`.
 */
export interface ProcessOfflineOptions {
  /** Source audio buffer to process. */
  input: AudioBuffer;

  /** URL or path to the formant-correction processor script. */
  processorUrl: string | URL;

  /** Pitch multiplier (1.0 = original pitch). */
  pitch?: number;

  /** Pitch shift in semitones, combined with `pitch`. */
  pitchSemitones?: number;

  /** Playback rate multiplier. Output length is scaled by `1 / playbackRate`. */
  playbackRate?: number;

  /** Formant correction strength (`0` raw, `1` full correction). */
  formantStrength?: number;

  /** Interpolation strategy for the internal rate transposer. */
  interpolationStrategy?: RateTransposerInterpolationStrategy;

  /** WSOLA timing parameters for the SoundTouch stretch stage. */
  stretchParameters?: StretchParameters;

  /** Internal sample buffer strategy. */
  sampleBufferType?: SampleBufferType;
}

/**
 * Renders an `AudioBuffer` through `FormantCorrectionNode` in an `OfflineAudioContext`.
 *
 * @param options Offline processing options.
 * @returns The rendered output `AudioBuffer`.
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
    formantStrength = 1.0,
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

  await FormantCorrectionNode.register(offlineCtx, processorUrl);

  const node = new FormantCorrectionNode({
    context: offlineCtx,
    interpolationStrategy,
    sampleBufferType,
  });

  node.pitch.value = pitch;
  node.pitchSemitones.value = pitchSemitones;
  node.playbackRate.value = playbackRate;
  node.formantStrength.value = formantStrength;

  if (stretchParameters) {
    node.setStretchParameters(stretchParameters);
  }

  node.connect(offlineCtx.destination);

  const source = offlineCtx.createBufferSource();
  source.buffer = input;
  source.playbackRate.value = playbackRate;
  source.connect(node);
  source.start(0);

  return offlineCtx.startRendering();
}
