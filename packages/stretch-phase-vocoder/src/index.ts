/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Main entry point for the `@soundtouchjs/stretch-phase-vocoder` package.
 *
 * @remarks
 * Exports `PhaseVocoder` (a `StretchPipe`-compatible time-stretch stage) and
 * `createPhaseVocoderFactory` (a helper for wiring it into `SoundTouch`).
 * Also re-exports FFT primitives and window generation for custom integrations.
 */
export { PhaseVocoder, createPhaseVocoderFactory } from './PhaseVocoder.js';
export type {
  PhaseVocoderFftSize,
  PhaseVocoderOptions,
  PhaseVocoderOverlapFactor,
} from './PhaseVocoder.js';
export { fft, ifft } from './fft.js';
export { makeHannWindow } from './windows.js';
