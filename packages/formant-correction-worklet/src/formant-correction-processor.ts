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
import type { ParameterDescriptor, ProcessCoreResult } from '@soundtouchjs/worklet-base';
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
  RateTransposerInterpolationStrategy,
  SampleBufferType,
} from '@soundtouchjs/core';

const PROCESSOR_NAME = 'formant-correction-processor';

/** @internal */
interface ProcessorConstructorOptions {
  processorOptions?: {
    sampleBufferType?: SampleBufferType;
    interpolationStrategy?: RateTransposerInterpolationStrategy;
  };
}

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
class FormantCorrectionProcessor extends SoundTouchProcessorBase {
  static get parameterDescriptors(): ParameterDescriptor[] {
    return [
      ...STANDARD_PARAMETER_DESCRIPTORS,
      {
        name: 'formantStrength',
        defaultValue: 1.0,
        minValue: 0.0,
        maxValue: 1.0,
        automationRate: 'k-rate',
      },
    ];
  }

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
    super('[FormantCorrectionProcessor]', {
      sampleRate,
      sampleBufferType:
        options?.processorOptions?.sampleBufferType ??
        DEFAULT_SAMPLE_BUFFER_TYPE,
      interpolationStrategy: SoundTouchProcessorBase.resolveStrategy(
        options?.processorOptions?.interpolationStrategy,
        '[FormantCorrectionProcessor]',
      ),
    });

    this._inputHistL = new Float32Array(LPC_WINDOW);
    this._inputHistR = new Float32Array(LPC_WINDOW);
    this._histPos = 0;
    this._lpcL = new Float32Array(LPC_ORDER);
    this._lpcR = new Float32Array(LPC_ORDER);
    this._analysisZiL = new Float32Array(LPC_ORDER);
    this._analysisZiR = new Float32Array(LPC_ORDER);
    this._synthesisZiL = new Float32Array(LPC_ORDER);
    this._synthesisZiR = new Float32Array(LPC_ORDER);
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

  protected override beforePipeProcess(
    leftInput: Float32Array,
    rightInput: Float32Array,
    frameCount: number,
    parameters: Record<string, Float32Array>,
  ): void {
    if ((parameters['formantStrength'][0] ?? 0) > 0) {
      this.updateLpc(leftInput, rightInput, frameCount);
    }
  }

  protected override extractSamples(
    leftOutput: Float32Array,
    rightOutput: Float32Array,
    frameCount: number,
    toExtract: number,
    parameters: Record<string, Float32Array>,
  ): { outputRms: number; outputPeak: number } {
    const formantStrength = parameters['formantStrength'][0] ?? 0;

    if (toExtract > 0) {
      const extracted = this._outputSamples;
      this._pipe.outputBuffer.extract(extracted, 0, toExtract);
      this._pipe.outputBuffer.receive(toExtract);

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

    return { outputRms: 0, outputPeak: 0 };
  }

  protected onProcessComplete(result: ProcessCoreResult): void {
    if (this._blockCount % 100 === 0) {
      this.port.postMessage({
        type: 'metrics',
        framesBuffered: result.available,
        underrunCount: this._underrunCount,
        blockCount: this._blockCount,
      } satisfies MetricsMessage);
    }
  }
}

registerProcessor(PROCESSOR_NAME, FormantCorrectionProcessor);
