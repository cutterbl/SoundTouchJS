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
import type {
  PhaseVocoderFftSize,
  PhaseVocoderOverlapFactor,
} from '@soundtouchjs/stretch-phase-vocoder';
import { PhaseVocoderNode } from './PhaseVocoderNode.js';

/**
 * Options for `processOffline` in the phase-vocoder worklet package.
 */
export interface ProcessOfflineOptions {
  /** Source audio buffer to process. */
  input: AudioBuffer;

  /** URL or path to the phase vocoder processor script. */
  processorUrl: string | URL;

  /** Pitch multiplier (1.0 = original pitch). */
  pitch?: number;

  /** Pitch shift in semitones, combined with `pitch`. */
  pitchSemitones?: number;

  /** Playback rate multiplier. Output length is scaled by `1 / playbackRate`. */
  playbackRate?: number;

  /** Interpolation strategy for the internal rate transposer. */
  interpolationStrategy?: RateTransposerInterpolationStrategy;

  /** WSOLA timing parameters (accepted for API parity; no-op for phase vocoder). */
  stretchParameters?: StretchParameters;

  /** Internal sample buffer strategy. */
  sampleBufferType?: SampleBufferType;

  /** FFT frame size for the phase vocoder stage. */
  fftSize?: PhaseVocoderFftSize;

  /** Overlap factor for the phase vocoder stage. */
  overlapFactor?: PhaseVocoderOverlapFactor;
}

/**
 * Renders an `AudioBuffer` through `PhaseVocoderNode` in an `OfflineAudioContext`.
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
    interpolationStrategy,
    stretchParameters,
    sampleBufferType,
    fftSize,
    overlapFactor,
  } = options;

  const outputLength = Math.ceil(input.length / playbackRate);

  const offlineCtx = new OfflineAudioContext(
    input.numberOfChannels,
    outputLength,
    input.sampleRate,
  );

  await PhaseVocoderNode.register(offlineCtx, processorUrl);

  const node = new PhaseVocoderNode({
    context: offlineCtx,
    interpolationStrategy,
    sampleBufferType,
    fftSize,
    overlapFactor,
  });

  node.pitch.value = pitch;
  node.pitchSemitones.value = pitchSemitones;
  node.playbackRate.value = playbackRate;

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
