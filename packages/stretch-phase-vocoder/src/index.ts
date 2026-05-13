/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License.
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
