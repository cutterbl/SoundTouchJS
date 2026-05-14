/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
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
export { processOffline } from './processOffline.js';
export type { ProcessOfflineOptions } from './processOffline.js';
