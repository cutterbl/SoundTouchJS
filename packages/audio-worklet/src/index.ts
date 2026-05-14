/*
 * SoundTouch JS audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 * Copyright (c) Jakub Fiala
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */
/**
 * Main entry point for the SoundTouch audio-worklet package.
 *
 * @remarks
 * Re-exports the SoundTouchNode class, its options types, and the processor name constant for use in host applications.
 */
export { SoundTouchNode } from './SoundTouchNode.js';
export type {
  ProcessorMetrics,
  SoundTouchNodeConstructorOptions,
  SoundTouchNodeOptions,
  StretchParameters,
} from './SoundTouchNode.js';
export { PROCESSOR_NAME } from './constants.js';
export { processOffline } from './processOffline.js';
export type { ProcessOfflineOptions } from './processOffline.js';
