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

import AbstractSamplePipe from './AbstractSamplePipe.js';
import CircularSampleBuffer from './CircularSampleBuffer.js';
import {
  createCircularSampleBufferAdapter,
  type SampleBufferAdapter,
  type SampleBufferAdapterFactory,
} from './SampleBufferAdapter.js';
import {
  resolveInterpolationStrategyRuntime,
  type InterpolationStrategyParams,
  type RateTransposerInterpolationStrategyId,
  type RateTransposerInterpolationStrategyOption,
  type InterpolationKernel,
} from './interpolationStrategyRegistry.js';
import type { SampleBuffer } from './SampleBuffer.js';

export type RateTransposerInterpolationStrategy =
  RateTransposerInterpolationStrategyOption;

export interface RateTransposerConstructorOptions {
  /** Whether to allocate internal buffers. */
  createBuffers?: boolean;
  /** Factory for creating adapters that normalize input reads. */
  sampleBufferAdapterFactory?: SampleBufferAdapterFactory;
  /** Factory for creating chain input/output buffers. */
  sampleBufferFactory?: () => SampleBuffer;
  /** Interpolation strategy used for resampling. */
  interpolationStrategy?: RateTransposerInterpolationStrategy;
}

/**
 * Sample rate transposer for pitch and tempo manipulation.
 *
 * @remarks
 * Used internally by SoundTouch for rate-based processing. Applies interpolation strategies to resample audio at different rates, supporting real-time pitch and tempo changes.
 */
export default class RateTransposer extends AbstractSamplePipe<
  SampleBuffer,
  SampleBuffer
> {
  /**
   * Current rate factor for transposition.
   */
  private _rate: number;

  /**
   * Source position (in frames) for the next output sample, relative to the
   * current processing block where 0 is the first frame and -1 is prevSample.
   */
  private fractionalPosition: number;

  /**
   * Previous left channel sample for interpolation.
   */
  private previousLeftSample: number;

  /**
   * Previous right channel sample for interpolation.
   */
  private previousRightSample: number;

  /** Scratch space used for extracted input samples. */
  private inputScratch: Float32Array;

  /** Scratch space used for generated output samples. */
  private outputScratch: Float32Array;

  /** Factory used when cloning or initializing adapter strategy. */
  private readonly sampleBufferAdapterFactory: SampleBufferAdapterFactory;

  /** Factory used to construct input/output chain buffers. */
  private readonly sampleBufferFactory: () => SampleBuffer;

  /** Adapter that normalizes reads from the bound input buffer. */
  private readonly inputAdapter: SampleBufferAdapter;

  /** Selected interpolation strategy for transposition. */
  private interpolationStrategy: RateTransposerInterpolationStrategyId;

  /** Resolved kernel used by this transposer instance. */
  private resolvedInterpolationKernel: InterpolationKernel;

  /** Optional per-instance state for plugin kernels. */
  private kernelState: unknown;

  /** Normalized params for the selected interpolation strategy. */
  private interpolationStrategyParams: InterpolationStrategyParams;

  /** Optional params application hook from the strategy registration. */
  private applyKernelParams:
    | ((state: unknown, params: InterpolationStrategyParams) => void)
    | undefined;


  /**
   * Creates a RateTransposer instance.
   * @param options Constructor options.
   * @remarks
   * Accepts factories for buffer and adapter creation, and allows specifying the interpolation strategy.
   */
  constructor({
    createBuffers = false,
    sampleBufferAdapterFactory = createCircularSampleBufferAdapter,
    sampleBufferFactory = () => new CircularSampleBuffer(),
    interpolationStrategy,
  }: RateTransposerConstructorOptions = {}) {
    super({
      createBuffers,
      inputBufferFactory: sampleBufferFactory,
      outputBufferFactory: sampleBufferFactory,
    });
    this.fractionalPosition = -1;
    this.previousLeftSample = 0;
    this.previousRightSample = 0;
    this._rate = 1;
    this.inputScratch = new Float32Array(0);
    this.outputScratch = new Float32Array(0);
    this.sampleBufferAdapterFactory = sampleBufferAdapterFactory;
    this.sampleBufferFactory = sampleBufferFactory;
    this.inputAdapter = sampleBufferAdapterFactory();
    this.interpolationStrategy = 'lanczos';
    this.resolvedInterpolationKernel = () => 0;
    this.kernelState = undefined;
    this.interpolationStrategyParams = {};
    this.applyKernelParams = undefined;
    this.setInterpolationStrategy(interpolationStrategy ?? 'lanczos');
  }

  /**
   * Sets the rate factor for transposition.
   * @param rate Rate factor.
   */
  set rate(rate: number) {
    this._rate = rate;
  }

  /**
   * Active interpolation strategy.
   * @returns The current interpolation strategy identifier.
   */
  get strategy(): RateTransposerInterpolationStrategyId {
    return this.interpolationStrategy;
  }

  /**
   * Active interpolation strategy params.
   * @returns The current interpolation strategy parameters.
   */
  get strategyParams(): Readonly<InterpolationStrategyParams> {
    return { ...this.interpolationStrategyParams };
  }

  /**
   * Switches interpolation strategy at runtime.
   * @param strategy The new interpolation strategy to use.
   */
  setInterpolationStrategy(
    strategy: RateTransposerInterpolationStrategy,
  ): void {
    const resolved = resolveInterpolationStrategyRuntime(strategy);
    this.interpolationStrategy = resolved.id;
    this.resolvedInterpolationKernel = resolved.kernel;
    this.interpolationStrategyParams = { ...resolved.params };
    this.applyKernelParams = resolved.applyParams;

    if (
      'createState' in this.resolvedInterpolationKernel &&
      typeof this.resolvedInterpolationKernel.createState === 'function'
    ) {
      this.kernelState = this.resolvedInterpolationKernel.createState();
    } else {
      this.kernelState = undefined;
    }

    if (this.applyKernelParams !== undefined) {
      this.applyKernelParams(
        this.kernelState,
        this.interpolationStrategyParams,
      );
    }

    this.reset();
  }

  /**
   * Applies a partial params update to the current interpolation strategy.
   * @param params Partial set of parameters to update.
   */
  setInterpolationStrategyParams(
    params: Partial<InterpolationStrategyParams>,
  ): void {
    const nextParams: InterpolationStrategyParams = {
      ...this.interpolationStrategyParams,
    };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        nextParams[key] = value;
      }
    }
    this.interpolationStrategyParams = nextParams;

    if (this.applyKernelParams !== undefined) {
      this.applyKernelParams(
        this.kernelState,
        this.interpolationStrategyParams,
      );
    }
  }

  /**
   * Resets internal state for interpolation.
   * @remarks
   * Clears previous sample values and resets the fractional position for output generation.
   */
  private reset(): void {
    this.fractionalPosition = -1;
    this.previousLeftSample = 0;
    this.previousRightSample = 0;
  }

  /**
   * Clears buffers and resets internal state.
   * @remarks
   * Calls clear on all internal buffers and resets interpolation state.
   */
  override clear(): void {
    super.clear();
    this.inputAdapter.clear();
    this.reset();
  }

  /**
   * Creates a clone of this RateTransposer with the same rate.
   * @returns Cloned RateTransposer instance.
   */
  clone(): RateTransposer {
    const result = new RateTransposer({
      createBuffers: false,
      sampleBufferAdapterFactory: this.sampleBufferAdapterFactory,
      sampleBufferFactory: this.sampleBufferFactory,
      interpolationStrategy: {
        id: this.interpolationStrategy,
        params: this.interpolationStrategyParams,
      },
    });
    result.rate = this._rate;
    return result;
  }

  /**
   * Processes input buffer and writes transposed samples to output buffer.
   * @remarks
   * Reads frames from the input buffer, applies rate transposition, and writes to the output buffer.
   */
  process(): void {
    if (this._inputBuffer === null || this._outputBuffer === null) {
      return;
    }

    this.inputAdapter.syncFromInputBuffer(this._inputBuffer);
    const numFrames = this.inputAdapter.frameCount;
    if (numFrames === 0) {
      return;
    }

    const numFramesOutput = this.transpose(numFrames);
    this.inputAdapter.receive(numFrames);

    if (numFramesOutput > 0) {
      this._outputBuffer!.putSamples(this.outputScratch, 0, numFramesOutput);
    }
  }

  /**
   * Ensures temporary scratch arrays are large enough for the current frame request and estimated output size.
   *
   * @param numInputFrames Number of input frames that will be processed.
   * @remarks
   * Allocates or resizes scratch arrays as needed for efficient processing.
   */
  private ensureScratchCapacity(numInputFrames: number): void {
    const inputSamples = numInputFrames * 2;
    if (this.inputScratch.length < inputSamples) {
      this.inputScratch = new Float32Array(inputSamples);
    }

    const estimatedOutputFrames = Math.ceil(numInputFrames / this._rate) + 2;
    const outputSamples = Math.max(0, estimatedOutputFrames) * 2;
    if (this.outputScratch.length < outputSamples) {
      this.outputScratch = new Float32Array(outputSamples);
    }
  }

  /**
   * Transposes input samples by the current rate.
   * @param numFrames Number of input frames to transpose.
   * @returns Number of output frames written.
   * @remarks
   * Applies the selected interpolation kernel to generate output samples at the new rate.
   */
  transpose(numFrames = 0): number {
    if (this._inputBuffer !== null) {
      this.inputAdapter.syncFromInputBuffer(this._inputBuffer);
      if (numFrames === 0) {
        numFrames = this.inputAdapter.frameCount;
      }
    }

    if (numFrames === 0) {
      return 0;
    }

    this.ensureScratchCapacity(numFrames);

    const src = this.inputScratch;
    const extractedFrames = this.inputAdapter.extract(src, 0, numFrames);
    if (extractedFrames === 0) {
      return 0;
    }
    numFrames = extractedFrames;

    return this.transposePluginKernel(numFrames);
  }

  /**
   * Handles transposition using a plugin kernel.
   * @remarks
   * Invokes the selected interpolation kernel for each output sample.
   */
  private transposePluginKernel(numFrames: number): number {
    const src = this.inputScratch;
    const dest = this.outputScratch;
    const srcOffset = 0;
    const destOffset = 0;
    const kernel = this.resolvedInterpolationKernel;
    const state = this.kernelState;
    const stateRecord = this.getKernelStateRecord(state);

    if (stateRecord !== undefined) {
      stateRecord.prevSampleL = this.previousLeftSample;
      stateRecord.prevSampleR = this.previousRightSample;
    }

    let i = 0;
    let position = this.fractionalPosition;
    const maxPosition = numFrames - 1;

    while (position <= maxPosition) {
      dest[destOffset + 2 * i] = kernel(
        src,
        srcOffset,
        numFrames,
        position,
        0,
        state,
      );
      dest[destOffset + 2 * i + 1] = kernel(
        src,
        srcOffset,
        numFrames,
        position,
        1,
        state,
      );
      i = i + 1;
      position += this._rate;
    }

    this.fractionalPosition = position - numFrames;

    this.previousLeftSample = src[srcOffset + 2 * numFrames - 2];
    this.previousRightSample = src[srcOffset + 2 * numFrames - 1];

    if (stateRecord !== undefined) {
      stateRecord.prevSampleL = this.previousLeftSample;
      stateRecord.prevSampleR = this.previousRightSample;
    }

    return i;
  }

  /**
   * Returns the kernel state record if available.
   * @param state The kernel state object.
   * @returns The state record with previous sample values, or undefined if not present.
   */
  private getKernelStateRecord(
    state: unknown,
  ): { prevSampleL: number; prevSampleR: number } | undefined {
    if (typeof state !== 'object' || state === null) {
      return undefined;
    }

    const record = state as Record<string, unknown>;
    const prevSampleL = record['prevSampleL'];
    const prevSampleR = record['prevSampleR'];
    if (typeof prevSampleL === 'number' && typeof prevSampleR === 'number') {
      return record as { prevSampleL: number; prevSampleR: number };
    }

    return undefined;
  }
}
