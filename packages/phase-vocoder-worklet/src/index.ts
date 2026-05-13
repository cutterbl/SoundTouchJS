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
 * Main entry point for the `@soundtouchjs/phase-vocoder-worklet` package.
 *
 * @remarks
 * Re-exports `PhaseVocoderNode`, its option types, and the processor name constant
 * for use in host applications.
 */
export { PhaseVocoderNode } from './PhaseVocoderNode.js';
export type {
  PhaseVocoderNodeConstructorOptions,
  PhaseVocoderNodeOptions,
  ProcessorMetrics,
  StretchParameters,
} from './PhaseVocoderNode.js';
export { PROCESSOR_NAME } from './constants.js';
