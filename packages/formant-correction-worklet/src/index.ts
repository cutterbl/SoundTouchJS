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
export {
  autocorrelate,
  levinsonDurbin,
  applyAnalysisFilter,
  applySynthesisFilter,
} from './lpc.js';
