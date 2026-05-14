/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Main entry point for the `@soundtouchjs/formant-correction-worklet` package.
 *
 * @remarks
 * Re-exports `FormantCorrectionNode`, its option types, the processor name constant,
 * and the LPC primitives for custom integrations.
 */
export { FormantCorrectionNode } from './FormantCorrectionNode.js';
export type {
  FormantCorrectionNodeConstructorOptions,
  FormantCorrectionNodeOptions,
  ProcessorMetrics,
  StretchParameters,
} from './FormantCorrectionNode.js';
export { PROCESSOR_NAME, LPC_ORDER, LPC_WINDOW } from './constants.js';
export { processOffline } from './processOffline.js';
export type { ProcessOfflineOptions } from './processOffline.js';
export {
  autocorrelate,
  levinsonDurbin,
  applyAnalysisFilter,
  applySynthesisFilter,
} from './lpc.js';
