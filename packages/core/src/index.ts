/*
 * SoundTouch JS audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 * Copyright (c) Jakub Fiala
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

export { default as AbstractSamplePipe } from './AbstractSamplePipe.js';
export { default as CircularSampleBuffer } from './CircularSampleBuffer.js';
export { default as FifoSampleBuffer } from './FifoSampleBuffer.js';
export { default as FilterSupport } from './FilterSupport.js';
export { default as RateTransposer } from './RateTransposer.js';
export { default as SimpleFilter } from './SimpleFilter.js';
export { default as Stretch } from './Stretch.js';
export { default as SoundTouch } from './SoundTouch.js';
export { default as WebAudioBufferSource } from './WebAudioBufferSource.js';
export { default as PitchShifter } from './PitchShifter.js';
export { default as getWebAudioNode } from './getWebAudioNode.js';

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
export type { SamplePipe } from './FilterSupport.js';
export type {
  SampleBuffer,
  SampleBufferFactory,
  SampleBufferType,
} from './SampleBuffer.js';
export type { PlayEventDetail } from './PitchShifter.js';
export type { PitchShifterOptions } from './PitchShifter.js';
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
export type { SourcePositionCallback } from './getWebAudioNode.js';
