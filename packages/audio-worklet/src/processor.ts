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
import { DEFAULT_SAMPLE_BUFFER_TYPE } from './constants.js';
import type {
  InterpolationStrategyParams,
  RateTransposerInterpolationStrategy,
  SampleBufferType,
} from '@soundtouchjs/core';

const PROCESSOR_NAME = 'soundtouch-processor';

/**
 * AudioParam descriptor shape expected by the worklet runtime.
 *
 * @remarks
 * Describes the metadata for each AudioParam exposed by the processor, including name, default value, and automation rate.
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
 * Constructor options passed by `SoundTouchNode` on initialization.
 *
 * @remarks
 * Used to configure the processor's internal buffer strategy and interpolation strategy.
 */
interface ProcessorConstructorOptions {
  processorOptions?: {
    /** Preferred internal buffer strategy for the SoundTouch pipeline. */
    sampleBufferType?: SampleBufferType;
    /** Interpolation strategy for rate transposition. */
    interpolationStrategy?: RateTransposerInterpolationStrategy;
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

type ProcessorMessage =
  | SetInterpolationStrategyMessage
  | SetInterpolationStrategyParamsMessage;

/**
 * Audio render-thread processor that applies SoundTouch transformations to stereo blocks.
 *
 * @remarks
 * Receives audio from the main thread, applies pitch, tempo, and rate transformations, and outputs processed stereo audio. Handles runtime strategy switching via messages.
 */
class SoundTouchProcessor extends AudioWorkletProcessor {
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
        name: 'tempo',
        defaultValue: 1.0,
        minValue: 0.1,
        maxValue: 8.0,
        automationRate: 'k-rate',
      },
      {
        name: 'rate',
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
      // Fallback to lanczos and log info
      // eslint-disable-next-line no-console
      console.info(
        '[SoundTouchProcessor] Unknown interpolation strategy id:',
        interpolationStrategy,
        '— falling back to lanczos.',
      );
      interpolationStrategy = 'lanczos';
    }
    this._pipe = new SoundTouch({
      sampleRate,
      sampleBufferType:
        options?.processorOptions?.sampleBufferType ??
        DEFAULT_SAMPLE_BUFFER_TYPE,
      interpolationStrategy,
    });
    this._samples = new Float32Array(128 * 2);
    this._outputSamples = new Float32Array(128 * 2);
    this.pendingInterpolationStrategy = null;
    this.pendingInterpolationStrategyParams = null;

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
          '[SoundTouchProcessor] Failed to switch interpolation strategy:',
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
          '[SoundTouchProcessor] Failed to update interpolation strategy params.',
        );
      }
      this.pendingInterpolationStrategyParams = null;
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
    const rightInput = input.length > 1 ? input[1] : input[0];
    const leftOutput = output[0];
    const rightOutput = output.length > 1 ? output[1] : output[0];
    const frameCount = leftInput.length;

    if (this._samples.length < frameCount * 2) {
      this._samples = new Float32Array(frameCount * 2);
      this._outputSamples = new Float32Array(frameCount * 2);
    }

    const rate = parameters['rate'][0];
    const tempo = parameters['tempo'][0];
    const pitch = parameters['pitch'][0];
    const pitchSemitones = parameters['pitchSemitones'][0];
    const playbackRate = parameters['playbackRate'][0];

    this._pipe.rate = rate;
    this._pipe.tempo = tempo;
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

registerProcessor(PROCESSOR_NAME, SoundTouchProcessor);
