/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SoundTouch, resolveInterpolationStrategy } from '@soundtouchjs/core';
import { DEFAULT_SAMPLE_BUFFER_TYPE } from './constants.js';
import type {
  InterpolationStrategyParams,
  RateTransposerInterpolationStrategy,
  SampleBufferType,
  StretchParameters,
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
  /** RMS of output block (last 128 frames, both channels averaged) */
  outputRms: number;
  /** Peak of output block (last 128 frames, both channels) */
  outputPeak: number;
}

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
      // Fallback to lanczos and log info
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
        console.info(
          '[SoundTouchProcessor] Failed to update interpolation strategy params.',
        );
      }
      this.pendingInterpolationStrategyParams = null;
    }

    if (this.pendingStretchParameters !== null) {
      try {
        this._pipe.setStretchParameters(this.pendingStretchParameters);
      } catch (err) {
        console.info(
          '[SoundTouchProcessor] Failed to update stretch parameters.',
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

    let outputRms = 0;
    let outputPeak = 0;
    if (toExtract > 0) {
      const extracted = this._outputSamples;
      outputBuffer.extract(extracted, 0, toExtract);
      outputBuffer.receive(toExtract);
      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < toExtract; i++) {
        const l = extracted[i * 2];
        const r = extracted[i * 2 + 1];
        leftOutput[i] = Number.isFinite(l) ? l : 0;
        rightOutput[i] = Number.isFinite(r) ? r : 0;
        sumSq += l * l + r * r;
        peak = Math.max(peak, Math.abs(l), Math.abs(r));
      }
      outputRms = Math.sqrt(sumSq / (toExtract * 2));
      outputPeak = peak;
    }

    for (let i = toExtract; i < frameCount; i++) {
      leftOutput[i] = 0;
      rightOutput[i] = 0;
    }

    // Post metrics to the main thread every 100 blocks.
    if (this._blockCount % 100 === 0) {
      this.port.postMessage({
        type: 'metrics',
        framesBuffered: available,
        underrunCount: this._underrunCount,
        blockCount: this._blockCount,
        outputRms,
        outputPeak,
      } satisfies MetricsMessage);
    }

    return true;
  }
}

registerProcessor(PROCESSOR_NAME, SoundTouchProcessor);
