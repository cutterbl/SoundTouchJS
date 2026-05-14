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

export { default as AbstractSamplePipe } from './AbstractSamplePipe.js';
export { default as CircularSampleBuffer } from './CircularSampleBuffer.js';
export { default as FifoSampleBuffer } from './FifoSampleBuffer.js';
export { default as RateTransposer } from './RateTransposer.js';
export { default as Stretch } from './Stretch.js';
export { default as SoundTouch } from './SoundTouch.js';
export type { StretchParameters } from './Stretch.js';

import {
  getActiveInterpolationStrategyId,
  hasInterpolationStrategy,
  resolveInterpolationStrategyRuntime,
  listInterpolationStrategies,
  normalizeInterpolationStrategyId,
  registerInterpolationStrategy,
  resolveInterpolationStrategy,
  setActiveInterpolationStrategy,
  unregisterInterpolationStrategy,
} from './interpolationStrategyRegistry.js';

export {
  getActiveInterpolationStrategyId,
  hasInterpolationStrategy,
  resolveInterpolationStrategyRuntime,
  listInterpolationStrategies,
  normalizeInterpolationStrategyId,
  registerInterpolationStrategy,
  resolveInterpolationStrategy,
  setActiveInterpolationStrategy,
  unregisterInterpolationStrategy,
};

// Exported types for consumers
export type {
  SampleBuffer,
  SampleBufferFactory,
  SampleBufferType,
} from './SampleBuffer.js';
export type { RateTransposerInterpolationStrategy } from './RateTransposer.js';
export type {
  BuiltInInterpolationStrategy,
  InterpolationStrategyParams,
  InterpolationStrategyRegistration,
  ResolvedInterpolationStrategyRuntime,
  RateTransposerInterpolationStrategyDescriptor,
  RateTransposerInterpolationStrategyId,
  RateTransposerInterpolationStrategyOption,
} from './interpolationStrategyRegistry.js';
export type { SoundTouchOptions } from './SoundTouch.js';
export type {
  StretchFactory,
  StretchFactoryOptions,
  StretchPipe,
} from './StretchPipe.js';
