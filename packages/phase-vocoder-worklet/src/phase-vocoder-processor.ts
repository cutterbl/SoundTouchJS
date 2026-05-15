/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  SoundTouchProcessorBase,
  STANDARD_PARAMETER_DESCRIPTORS,
} from '@soundtouchjs/worklet-base';
import { createPhaseVocoderFactory } from '@soundtouchjs/stretch-phase-vocoder';
import { DEFAULT_SAMPLE_BUFFER_TYPE } from './constants.js';
import type { ProcessCoreResult } from '@soundtouchjs/worklet-base';
import type {
  RateTransposerInterpolationStrategy,
  SampleBufferType,
} from '@soundtouchjs/core';
import type {
  PhaseVocoderFftSize,
  PhaseVocoderOverlapFactor,
} from '@soundtouchjs/stretch-phase-vocoder';

const PROCESSOR_NAME = 'phase-vocoder-processor';

/**
 * Constructor options passed by `PhaseVocoderNode` on initialization.
 *
 * @remarks
 * Configures the processor's internal buffer strategy, interpolation strategy,
 * and phase vocoder FFT parameters.
 */
interface ProcessorConstructorOptions {
  processorOptions?: {
    /** Preferred internal buffer strategy for the SoundTouch pipeline. */
    sampleBufferType?: SampleBufferType;
    /** Interpolation strategy for rate transposition. */
    interpolationStrategy?: RateTransposerInterpolationStrategy;
    /** FFT frame size for the phase vocoder. */
    fftSize?: PhaseVocoderFftSize;
    /** Overlap factor for the phase vocoder. */
    overlapFactor?: PhaseVocoderOverlapFactor;
  };
}

/** Metrics snapshot sent from the processor to the main thread every 100 render blocks. */
interface MetricsMessage {
  type: 'metrics';
  /** Frames available in the output buffer at the time of the last render block. */
  framesBuffered: number;
  /** Cumulative count of render blocks where the output buffer had fewer frames than requested. */
  underrunCount: number;
  /** Total render blocks processed since the processor was created. */
  blockCount: number;
  /** RMS of output block (last 128 frames, both channels averaged) */
  outputRms: number;
  /** Peak of output block (last 128 frames, both channels) */
  outputPeak: number;
}

/**
 * Audio render-thread processor that applies SoundTouch + phase vocoder transformations.
 *
 * @remarks
 * Uses a `PhaseVocoder` as the time-stretch stage (via `stretchFactory`) inside
 * a `SoundTouch` pipeline, enabling smoother time-stretching at extreme ratios
 * compared to the default WSOLA algorithm. Handles runtime strategy switching and
 * reports observability metrics via the message port.
 */
class PhaseVocoderProcessor extends SoundTouchProcessorBase {
  /** Static AudioParam metadata consumed by the browser. */
  static get parameterDescriptors() {
    return STANDARD_PARAMETER_DESCRIPTORS;
  }

  /**
   * @param options Worklet constructor options provided by the main thread.
   *
   * @remarks
   * Unknown interpolation strategy ids are logged and coerced to `lanczos`
   * so render-thread startup remains resilient.
   */
  constructor(options?: ProcessorConstructorOptions) {
    const fftSize = options?.processorOptions?.fftSize ?? 2048;
    const overlapFactor = options?.processorOptions?.overlapFactor ?? 4;
    super('[PhaseVocoderProcessor]', {
      sampleRate,
      sampleBufferType:
        options?.processorOptions?.sampleBufferType ??
        DEFAULT_SAMPLE_BUFFER_TYPE,
      interpolationStrategy: SoundTouchProcessorBase.resolveStrategy(
        options?.processorOptions?.interpolationStrategy,
        '[PhaseVocoderProcessor]',
      ),
      stretchFactory: createPhaseVocoderFactory(fftSize, overlapFactor),
    });
  }

  protected onProcessComplete(result: ProcessCoreResult): void {
    if (this._blockCount % 100 === 0) {
      this.port.postMessage({
        type: 'metrics',
        framesBuffered: result.available,
        underrunCount: this._underrunCount,
        blockCount: this._blockCount,
        outputRms: result.outputRms,
        outputPeak: result.outputPeak,
      } satisfies MetricsMessage);
    }
  }
}

registerProcessor(PROCESSOR_NAME, PhaseVocoderProcessor);
