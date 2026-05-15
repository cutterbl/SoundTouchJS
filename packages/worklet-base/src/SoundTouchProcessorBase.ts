/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { SoundTouch, resolveInterpolationStrategy } from '@soundtouchjs/core';
import type {
  InterpolationStrategyParams,
  RateTransposerInterpolationStrategy,
  SoundTouchOptions,
  StretchParameters,
} from '@soundtouchjs/core';
import type { ProcessCoreResult, ProcessorMessage } from './types.js';

/**
 * Abstract base class for all SoundTouchJS AudioWorklet processor implementations.
 *
 * @remarks
 * Centralises shared state (pipe, sample buffers, runtime-update queue), the
 * `applyPendingRuntimeUpdates` helper, and the core DSP pipeline in
 * `processCore`. Subclasses must implement `process` and `onProcessComplete`.
 *
 * The default `process` implementation calls `applyPendingRuntimeUpdates`,
 * `processCore`, and then `onProcessComplete`. Subclasses that need to
 * interleave additional logic (e.g. LPC analysis) can override `beforePipeProcess`
 * and/or `extractSamples` instead of overriding `process` entirely.
 */
export abstract class SoundTouchProcessorBase extends AudioWorkletProcessor {
  /** The SoundTouch DSP pipeline instance. */
  protected _pipe: SoundTouch;
  /** Interleaved (L, R, L, R, …) input staging buffer. */
  protected _samples: Float32Array;
  /** Interleaved output staging buffer populated by `extractSamples`. */
  protected _outputSamples: Float32Array;
  /** Cumulative count of render blocks where the output buffer ran short. */
  protected _underrunCount = 0;
  /** Total render blocks processed since construction. */
  protected _blockCount = 0;

  private _pendingInterpolationStrategy: RateTransposerInterpolationStrategy | null =
    null;
  private _pendingInterpolationStrategyParams: Partial<InterpolationStrategyParams> | null =
    null;
  private _pendingStretchParameters: StretchParameters | null = null;

  /** Label used in console messages (e.g. `'[SoundTouchProcessor]'`). */
  protected readonly processorLabel: string;

  /**
   * Validates and resolves an interpolation strategy id, falling back to
   * `'lanczos'` if the id is unrecognised.
   *
   * @remarks
   * Call this as a static expression inside the `super()` argument list of a
   * subclass constructor so that strategy resolution happens before pipe creation.
   *
   * @param strategy - The strategy id provided by the caller.
   * @param processorLabel - Label included in the fallback console message.
   * @returns The original `strategy` if valid, or `'lanczos'` as a fallback.
   */
  protected static resolveStrategy(
    strategy: RateTransposerInterpolationStrategy | undefined,
    processorLabel: string,
  ): RateTransposerInterpolationStrategy | undefined {
    try {
      if (strategy) {
        resolveInterpolationStrategy(strategy);
      }
      return strategy;
    } catch {
      console.info(
        `${processorLabel} Unknown interpolation strategy id:`,
        strategy,
        '— falling back to lanczos.',
      );
      return 'lanczos';
    }
  }

  /**
   * @param processorLabel - Label string used in diagnostic messages.
   * @param pipeOptions - Options forwarded to the `SoundTouch` constructor. The
   *   `sampleRate` global must be available in the AudioWorklet scope.
   */
  constructor(processorLabel: string, pipeOptions: SoundTouchOptions) {
    super();
    this.processorLabel = processorLabel;
    this._pipe = new SoundTouch(pipeOptions);
    this._samples = new Float32Array(128 * 2);
    this._outputSamples = new Float32Array(128 * 2);

    const port = this.port;
    if (port !== undefined) {
      port.onmessage = (event: MessageEvent<ProcessorMessage>) => {
        const message = event.data;
        if (message.type === 'set-interpolation-strategy') {
          this._pendingInterpolationStrategy = message.strategy;
          return;
        }
        if (message.type === 'set-interpolation-strategy-params') {
          this._pendingInterpolationStrategyParams = message.params;
          return;
        }
        if (message.type === 'set-stretch-parameters') {
          this._pendingStretchParameters = message.params;
        }
      };
    }
  }

  /**
   * Flushes any pending interpolation-strategy or stretch-parameter change
   * that arrived via `port.onmessage` since the last render block.
   *
   * @remarks
   * Call this at the top of `process` before touching `_pipe`.
   */
  protected applyPendingRuntimeUpdates(): void {
    if (this._pendingInterpolationStrategy !== null) {
      try {
        this._pipe.setInterpolationStrategy(
          this._pendingInterpolationStrategy,
        );
      } catch {
        console.info(
          `${this.processorLabel} Failed to switch interpolation strategy:`,
          this._pendingInterpolationStrategy,
        );
      }
      this._pendingInterpolationStrategy = null;
    }

    if (this._pendingInterpolationStrategyParams !== null) {
      try {
        this._pipe.setInterpolationStrategyParams(
          this._pendingInterpolationStrategyParams,
        );
      } catch {
        console.info(
          `${this.processorLabel} Failed to update interpolation strategy params.`,
        );
      }
      this._pendingInterpolationStrategyParams = null;
    }

    if (this._pendingStretchParameters !== null) {
      try {
        this._pipe.setStretchParameters(this._pendingStretchParameters);
      } catch {
        console.info(
          `${this.processorLabel} Failed to update stretch parameters.`,
        );
      }
      this._pendingStretchParameters = null;
    }
  }

  /**
   * Optional hook called after input routing and buffer resize but **before**
   * the SoundTouch pipe processes the block.
   *
   * @remarks
   * Override in subclasses that need to inspect or transform the raw input
   * before it enters the DSP pipeline (e.g. computing LPC coefficients).
   *
   * @param _leftInput - Left-channel input for this render block.
   * @param _rightInput - Right-channel input (same as left for mono sources).
   * @param _frameCount - Number of frames in this block.
   * @param _parameters - AudioParam k-rate values for this render block.
   */
  protected beforePipeProcess(
    _leftInput: Float32Array,
    _rightInput: Float32Array,
    _frameCount: number,
    _parameters: Record<string, Float32Array>,
  ): void {}

  /**
   * Extracts rendered frames from the output buffer, writes them to
   * `leftOutput`/`rightOutput`, zero-fills any gap, and returns RMS/peak metrics.
   *
   * @remarks
   * Override in subclasses that apply post-extraction transforms (e.g. formant
   * correction). Overrides are responsible for the full extraction, write-back,
   * silence fill, and returning `{ outputRms, outputPeak }`.
   *
   * @param leftOutput - Destination view for the left channel.
   * @param rightOutput - Destination view for the right channel.
   * @param frameCount - Total frames expected in this block.
   * @param toExtract - Frames available to extract (≤ frameCount).
   * @param _parameters - AudioParam k-rate values (available for overrides).
   * @returns RMS and peak of the extracted block.
   */
  protected extractSamples(
    leftOutput: Float32Array,
    rightOutput: Float32Array,
    frameCount: number,
    toExtract: number,
    _parameters: Record<string, Float32Array>,
  ): { outputRms: number; outputPeak: number } {
    let outputRms = 0;
    let outputPeak = 0;

    if (toExtract > 0) {
      const extracted = this._outputSamples;
      this._pipe.outputBuffer.extract(extracted, 0, toExtract);
      this._pipe.outputBuffer.receive(toExtract);
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

    return { outputRms, outputPeak };
  }

  /**
   * Runs the full DSP pipeline for one render block and returns metrics.
   *
   * @remarks
   * Handles input routing, buffer resize, `beforePipeProcess`, pitch
   * calculation, sample interleaving, pipe feed/process, counter updates,
   * and `extractSamples`. Returns `null` when the input is empty or
   * the output has not been allocated, keeping the processor alive.
   *
   * @param inputs - AudioWorklet input buses.
   * @param outputs - AudioWorklet output buses.
   * @param parameters - k-rate AudioParam values.
   * @returns Render-block result, or `null` if inputs are not ready.
   */
  protected processCore(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): ProcessCoreResult | null {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length || !output[0] || !output[0].length) {
      return null;
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

    this.beforePipeProcess(leftInput, rightInput, frameCount, parameters);

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

    const { outputRms, outputPeak } = this.extractSamples(
      leftOutput,
      rightOutput,
      frameCount,
      toExtract,
      parameters,
    );

    return {
      frameCount,
      toExtract,
      available,
      leftInput,
      rightInput,
      leftOutput,
      rightOutput,
      outputRms,
      outputPeak,
    };
  }

  /**
   * Called after a successful `processCore` invocation with the render-block result.
   *
   * @remarks
   * Implement this to post processor-specific metrics to the main thread.
   * The default `process` implementation calls this after `processCore`.
   *
   * @param result - Data from the completed render block.
   */
  protected abstract onProcessComplete(result: ProcessCoreResult): void;

  /**
   * AudioWorkletProcessor render callback. Keeps the processor alive by always returning `true`.
   *
   * @remarks
   * The default implementation calls `applyPendingRuntimeUpdates`, `processCore`,
   * and `onProcessComplete`. Override only when the execution order must differ
   * (e.g. pre-pipe analysis steps not covered by `beforePipeProcess`).
   *
   * @param inputs - AudioWorklet input buses.
   * @param outputs - AudioWorklet output buses.
   * @param parameters - k-rate AudioParam values.
   * @returns Always `true` to keep the processor alive.
   */
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    this.applyPendingRuntimeUpdates();
    const result = this.processCore(inputs, outputs, parameters);
    if (result !== null) {
      this.onProcessComplete(result);
    }
    return true;
  }
}
