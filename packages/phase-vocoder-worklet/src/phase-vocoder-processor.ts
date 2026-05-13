/*
 * SoundTouch JS audio processing library
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

import { SoundTouch, resolveInterpolationStrategy } from '@soundtouchjs/core';
import {
  createPhaseVocoderFactory,
} from '@soundtouchjs/stretch-phase-vocoder';
import { DEFAULT_SAMPLE_BUFFER_TYPE } from './constants.js';
import type {
  InterpolationStrategyParams,
  RateTransposerInterpolationStrategy,
  SampleBufferType,
  StretchParameters,
} from '@soundtouchjs/core';
import type {
  PhaseVocoderFftSize,
  PhaseVocoderOverlapFactor,
} from '@soundtouchjs/stretch-phase-vocoder';

const PROCESSOR_NAME = 'phase-vocoder-processor';

/**
 * AudioParam descriptor shape expected by the worklet runtime.
 *
 * @remarks
 * Describes the metadata for each AudioParam exposed by the processor.
 */
interface ParameterDescriptor {
  /** Parameter name exposed on the node. */
  name: string;
  /** Default parameter value when no automation is present. */
  defaultValue: number;
  /** Lower bound enforced by the audio param. */
  minValue: number;
  /** Upper bound enforced by the audio param. */
  maxValue: number;
  /** Automation rate selected for this parameter. */
  automationRate: 'k-rate' | 'a-rate';
}

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

interface SetInterpolationStrategyMessage {
  type: 'set-interpolation-strategy';
  strategy: RateTransposerInterpolationStrategy;
}

interface SetInterpolationStrategyParamsMessage {
  type: 'set-interpolation-strategy-params';
  params: Partial<InterpolationStrategyParams>;
}

interface SetStretchParametersMessage {
  type: 'set-stretch-parameters';
  params: StretchParameters;
}

type ProcessorMessage =
  | SetInterpolationStrategyMessage
  | SetInterpolationStrategyParamsMessage
  | SetStretchParametersMessage;

/** Metrics snapshot sent from the processor to the main thread every 100 render blocks. */
interface MetricsMessage {
  type: 'metrics';
  /** Frames available in the output buffer at the time of the last render block. */
  framesBuffered: number;
  /** Cumulative count of render blocks where the output buffer had fewer frames than requested. */
  underrunCount: number;
  /** Total render blocks processed since the processor was created. */
  blockCount: number;
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
class PhaseVocoderProcessor extends AudioWorkletProcessor {
  /** Static AudioParam metadata consumed by the browser. */
  static get parameterDescriptors(): ParameterDescriptor[] {
    return [
      {
        name: 'pitch',
        defaultValue: 1.0,
        minValue: 0.1,
        maxValue: 8.0,
        automationRate: 'k-rate',
      },
      {
        name: 'pitchSemitones',
        defaultValue: 0,
        minValue: -24,
        maxValue: 24,
        automationRate: 'k-rate',
      },
      {
        name: 'playbackRate',
        defaultValue: 1.0,
        minValue: 0.1,
        maxValue: 8.0,
        automationRate: 'k-rate',
      },
    ];
  }

  private _pipe: SoundTouch;
  private _samples: Float32Array;
  private _outputSamples: Float32Array;
  private pendingInterpolationStrategy: RateTransposerInterpolationStrategy | null;
  private pendingInterpolationStrategyParams: Partial<InterpolationStrategyParams> | null;
  private pendingStretchParameters: StretchParameters | null;
  private _underrunCount: number;
  private _blockCount: number;

  /**
   * @param options Worklet constructor options provided by the main thread.
   *
   * @remarks
   * Unknown interpolation strategy ids are logged and coerced to `lanczos`
   * so render-thread startup remains resilient.
   */
  constructor(options?: ProcessorConstructorOptions) {
    super();
    let interpolationStrategy =
      options?.processorOptions?.interpolationStrategy;
    try {
      if (interpolationStrategy) {
        resolveInterpolationStrategy(interpolationStrategy);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.info(
        '[PhaseVocoderProcessor] Unknown interpolation strategy id:',
        interpolationStrategy,
        '— falling back to lanczos.',
      );
      interpolationStrategy = 'lanczos';
    }

    const fftSize = options?.processorOptions?.fftSize ?? 2048;
    const overlapFactor = options?.processorOptions?.overlapFactor ?? 4;

    this._pipe = new SoundTouch({
      sampleRate,
      sampleBufferType:
        options?.processorOptions?.sampleBufferType ??
        DEFAULT_SAMPLE_BUFFER_TYPE,
      interpolationStrategy,
      stretchFactory: createPhaseVocoderFactory(fftSize, overlapFactor),
    });
    this._samples = new Float32Array(128 * 2);
    this._outputSamples = new Float32Array(128 * 2);
    this.pendingInterpolationStrategy = null;
    this.pendingInterpolationStrategyParams = null;
    this.pendingStretchParameters = null;
    this._underrunCount = 0;
    this._blockCount = 0;

    const port = this.port;
    if (port !== undefined) {
      port.onmessage = (event: MessageEvent<ProcessorMessage>) => {
        const message = event.data;
        if (message.type === 'set-interpolation-strategy') {
          this.pendingInterpolationStrategy = message.strategy;
          return;
        }
        if (message.type === 'set-interpolation-strategy-params') {
          this.pendingInterpolationStrategyParams = message.params;
          return;
        }
        if (message.type === 'set-stretch-parameters') {
          this.pendingStretchParameters = message.params;
        }
      };
    }
  }

  private applyPendingRuntimeUpdates(): void {
    if (this.pendingInterpolationStrategy !== null) {
      try {
        this._pipe.setInterpolationStrategy(this.pendingInterpolationStrategy);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.info(
          '[PhaseVocoderProcessor] Failed to switch interpolation strategy:',
          this.pendingInterpolationStrategy,
        );
      }
      this.pendingInterpolationStrategy = null;
    }

    if (this.pendingInterpolationStrategyParams !== null) {
      try {
        this._pipe.setInterpolationStrategyParams(
          this.pendingInterpolationStrategyParams,
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.info(
          '[PhaseVocoderProcessor] Failed to update interpolation strategy params.',
        );
      }
      this.pendingInterpolationStrategyParams = null;
    }

    if (this.pendingStretchParameters !== null) {
      try {
        this._pipe.setStretchParameters(this.pendingStretchParameters);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.info(
          '[PhaseVocoderProcessor] Failed to update stretch parameters.',
        );
      }
      this.pendingStretchParameters = null;
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    // Keep processor alive for the lifetime of the node.
    this.applyPendingRuntimeUpdates();

    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length || !output[0] || !output[0].length) {
      return true;
    }

    const leftInput = input[0];
    // Mono input: duplicate the single channel to both sides of the stereo pipeline.
    const rightInput = input.length > 1 ? input[1] : input[0];
    const leftOutput = output[0];
    // Mono output (outputChannelCount: 1): both channels write to the same array.
    const rightOutput = output.length > 1 ? output[1] : output[0];
    const frameCount = leftInput.length;

    if (this._samples.length < frameCount * 2) {
      this._samples = new Float32Array(frameCount * 2);
      this._outputSamples = new Float32Array(frameCount * 2);
    }

    const pitch = parameters['pitch'][0];
    const pitchSemitones = parameters['pitchSemitones'][0];
    const playbackRate = parameters['playbackRate'][0];

    this._pipe.pitch =
      (pitch * Math.pow(2, pitchSemitones / 12)) / playbackRate;

    const samples = this._samples;

    for (let i = 0; i < frameCount; i++) {
      samples[i * 2] = leftInput[i];
      samples[i * 2 + 1] = rightInput[i];
    }

    this._pipe.inputBuffer.putSamples(samples, 0, frameCount);
    this._pipe.process();

    const outputBuffer = this._pipe.outputBuffer;
    const available = outputBuffer.frameCount;
    const toExtract = Math.min(available, frameCount);

    this._blockCount++;
    if (available < frameCount) {
      this._underrunCount++;
    }

    // Post metrics to the main thread every 100 blocks.
    if (this._blockCount % 100 === 0) {
      this.port.postMessage({
        type: 'metrics',
        framesBuffered: available,
        underrunCount: this._underrunCount,
        blockCount: this._blockCount,
      } satisfies MetricsMessage);
    }

    if (toExtract > 0) {
      const extracted = this._outputSamples;
      outputBuffer.extract(extracted, 0, toExtract);
      outputBuffer.receive(toExtract);
      for (let i = 0; i < toExtract; i++) {
        const l = extracted[i * 2];
        const r = extracted[i * 2 + 1];
        leftOutput[i] = Number.isFinite(l) ? l : 0;
        rightOutput[i] = Number.isFinite(r) ? r : 0;
      }
    }

    for (let i = toExtract; i < frameCount; i++) {
      leftOutput[i] = 0;
      rightOutput[i] = 0;
    }

    return true;
  }
}

registerProcessor(PROCESSOR_NAME, PhaseVocoderProcessor);
