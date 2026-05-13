/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License.
 */

import { SoundTouch, resolveInterpolationStrategy } from '@soundtouchjs/core';
import {
  DEFAULT_SAMPLE_BUFFER_TYPE,
  LPC_ORDER,
  LPC_WINDOW,
} from './constants.js';
import {
  autocorrelate,
  levinsonDurbin,
  applyAnalysisFilter,
  applySynthesisFilter,
} from './lpc.js';
import type {
  InterpolationStrategyParams,
  RateTransposerInterpolationStrategy,
  SampleBufferType,
  StretchParameters,
} from '@soundtouchjs/core';

const PROCESSOR_NAME = 'formant-correction-processor';

/** @internal */
interface ParameterDescriptor {
  name: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  automationRate: 'k-rate' | 'a-rate';
}

/** @internal */
interface ProcessorConstructorOptions {
  processorOptions?: {
    sampleBufferType?: SampleBufferType;
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

/** @internal */
interface MetricsMessage {
  type: 'metrics';
  framesBuffered: number;
  underrunCount: number;
  blockCount: number;
}

/**
 * Audio render-thread processor that applies SoundTouch pitch-shifting with
 * LPC-based formant preservation.
 *
 * @remarks
 * For each render block the processor:
 * 1. Feeds original input to the SoundTouch pipeline to produce pitch-shifted output.
 * 2. Computes LPC coefficients from a 512-sample sliding window of the input signal.
 * 3. Applies the LPC analysis filter to the pitch-shifted output (removes shifted formants).
 * 4. Applies the LPC synthesis filter with the original input coefficients (restores original formants).
 * 5. Blends the corrected signal with the raw pitch-shifted signal using `formantStrength`.
 *
 * When `formantStrength = 0` the output is identical to `SoundTouchNode`.
 * When `formantStrength = 1` formants are fully locked to the original pitch.
 */
class FormantCorrectionProcessor extends AudioWorkletProcessor {
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
      {
        name: 'formantStrength',
        defaultValue: 1.0,
        minValue: 0.0,
        maxValue: 1.0,
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

  // Per-channel LPC state.
  private _inputHistL: Float32Array;
  private _inputHistR: Float32Array;
  private _histPos: number;
  private _lpcL: Float32Array;
  private _lpcR: Float32Array;
  private _analysisZiL: Float32Array;
  private _analysisZiR: Float32Array;
  private _synthesisZiL: Float32Array;
  private _synthesisZiR: Float32Array;

  /**
   * @param options Worklet constructor options from the main thread.
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
        '[FormantCorrectionProcessor] Unknown interpolation strategy id:',
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

    this._inputHistL = new Float32Array(LPC_WINDOW);
    this._inputHistR = new Float32Array(LPC_WINDOW);
    this._histPos = 0;
    this._lpcL = new Float32Array(LPC_ORDER);
    this._lpcR = new Float32Array(LPC_ORDER);
    this._analysisZiL = new Float32Array(LPC_ORDER);
    this._analysisZiR = new Float32Array(LPC_ORDER);
    this._synthesisZiL = new Float32Array(LPC_ORDER);
    this._synthesisZiR = new Float32Array(LPC_ORDER);

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
          '[FormantCorrectionProcessor] Failed to switch interpolation strategy:',
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
          '[FormantCorrectionProcessor] Failed to update interpolation strategy params.',
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
          '[FormantCorrectionProcessor] Failed to update stretch parameters.',
        );
      }
      this.pendingStretchParameters = null;
    }
  }

  /**
   * Updates the LPC circular input buffer and recomputes coefficients for both channels.
   */
  private updateLpc(
    leftInput: Float32Array,
    rightInput: Float32Array,
    frameCount: number,
  ): void {
    for (let i = 0; i < frameCount; i++) {
      this._inputHistL[this._histPos] = leftInput[i];
      this._inputHistR[this._histPos] = rightInput[i];
      this._histPos = (this._histPos + 1) % LPC_WINDOW;
    }

    // Extract ordered window (oldest → newest) from circular buffer.
    const winL = new Float32Array(LPC_WINDOW);
    const winR = new Float32Array(LPC_WINDOW);
    for (let i = 0; i < LPC_WINDOW; i++) {
      const idx = (this._histPos + i) % LPC_WINDOW;
      winL[i] = this._inputHistL[idx];
      winR[i] = this._inputHistR[idx];
    }

    this._lpcL = levinsonDurbin(autocorrelate(winL, LPC_ORDER), LPC_ORDER);
    this._lpcR = levinsonDurbin(autocorrelate(winR, LPC_ORDER), LPC_ORDER);
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
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

    const pitch = parameters['pitch'][0];
    const pitchSemitones = parameters['pitchSemitones'][0];
    const playbackRate = parameters['playbackRate'][0];
    const formantStrength = parameters['formantStrength'][0];

    // Update LPC from input before sending to SoundTouch.
    if (formantStrength > 0) {
      this.updateLpc(leftInput, rightInput, frameCount);
    }

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

      if (formantStrength > 0) {
        // Split pitch-shifted output into per-channel arrays.
        const rawL = new Float32Array(toExtract);
        const rawR = new Float32Array(toExtract);
        for (let i = 0; i < toExtract; i++) {
          rawL[i] = extracted[i * 2];
          rawR[i] = extracted[i * 2 + 1];
        }

        // Remove shifted formants from pitch-shifted output; re-add original.
        const residualL = applyAnalysisFilter(rawL, this._lpcL, this._analysisZiL);
        const residualR = applyAnalysisFilter(rawR, this._lpcR, this._analysisZiR);
        const corrL = applySynthesisFilter(residualL, this._lpcL, this._synthesisZiL);
        const corrR = applySynthesisFilter(residualR, this._lpcR, this._synthesisZiR);

        const s = formantStrength;
        const si = 1 - s;
        for (let i = 0; i < toExtract; i++) {
          const l = si * rawL[i] + s * corrL[i];
          const r = si * rawR[i] + s * corrR[i];
          leftOutput[i] = Number.isFinite(l) ? l : 0;
          rightOutput[i] = Number.isFinite(r) ? r : 0;
        }
      } else {
        for (let i = 0; i < toExtract; i++) {
          const l = extracted[i * 2];
          const r = extracted[i * 2 + 1];
          leftOutput[i] = Number.isFinite(l) ? l : 0;
          rightOutput[i] = Number.isFinite(r) ? r : 0;
        }
      }
    }

    for (let i = toExtract; i < frameCount; i++) {
      leftOutput[i] = 0;
      rightOutput[i] = 0;
    }

    return true;
  }
}

registerProcessor(PROCESSOR_NAME, FormantCorrectionProcessor);
