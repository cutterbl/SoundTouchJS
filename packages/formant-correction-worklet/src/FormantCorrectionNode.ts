/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License.
 */

import type {
  InterpolationStrategyParams,
  RateTransposerInterpolationStrategy,
  SampleBufferType,
  StretchParameters,
} from '@soundtouchjs/core';
export type { StretchParameters } from '@soundtouchjs/core';
import { DEFAULT_SAMPLE_BUFFER_TYPE, PROCESSOR_NAME } from './constants.js';

/**
 * Snapshot of processor performance metrics received from the render thread.
 *
 * @remarks
 * Emitted every 100 render blocks via the `metrics` CustomEvent.
 * Access the latest snapshot via `FormantCorrectionNode.metrics`.
 */
export interface ProcessorMetrics {
  /** Frames available in the output buffer at the last render block. */
  framesBuffered: number;
  /** Cumulative render blocks where the output buffer had fewer frames than requested. */
  underrunCount: number;
  /** Total render blocks processed since the processor was created. */
  blockCount: number;
  /** `performance.now()` timestamp recorded on the main thread when metrics arrived. */
  timestamp: DOMHighResTimeStamp;
}

/**
 * Construction options for `FormantCorrectionNode`.
 */
export interface FormantCorrectionNodeOptions {
  /** Internal sample buffer strategy. */
  sampleBufferType?: SampleBufferType;
  /** Rate-transposer interpolation strategy. */
  interpolationStrategy?: RateTransposerInterpolationStrategy;
}

/**
 * Construction options for the `FormantCorrectionNode` constructor.
 */
export interface FormantCorrectionNodeConstructorOptions
  extends FormantCorrectionNodeOptions {
  /**
   * AudioContext or OfflineAudioContext for node construction.
   */
  context: BaseAudioContext;

  /**
   * Number of output channels. Defaults to `2` (stereo).
   *
   * @remarks
   * Set to `1` when connecting to a mono destination. The processor always
   * processes interleaved stereo internally. Mono input is always supported —
   * the processor duplicates a single input channel to both stereo sides.
   */
  outputChannelCount?: 1 | 2;
}

/**
 * Main-thread AudioWorkletNode that applies SoundTouch pitch-shifting with
 * LPC-based formant correction.
 *
 * @remarks
 * Wraps `FormantCorrectionProcessor` and provides the same AudioParam accessors
 * as `SoundTouchNode`, plus a `formantStrength` param that controls how strongly
 * the original formant envelope is preserved after pitch shifting.
 *
 * - `formantStrength = 0` — identical output to `SoundTouchNode` (no correction)
 * - `formantStrength = 1` — original formants fully preserved at the new pitch
 *
 * @example
 * ```ts
 * import { FormantCorrectionNode } from '@soundtouchjs/formant-correction-worklet';
 *
 * await FormantCorrectionNode.register(audioCtx, processorUrl);
 * const node = new FormantCorrectionNode({ context: audioCtx });
 * node.pitchSemitones.value = 7;   // up a fifth
 * node.formantStrength.value = 1;  // keep original timbre
 * ```
 */
export class FormantCorrectionNode extends AudioWorkletNode {
  /**
   * The registered processor name for this node type.
   */
  static readonly processorName = PROCESSOR_NAME;

  /**
   * Registers the formant correction processor module with the given AudioContext.
   *
   * @param context - The AudioContext or OfflineAudioContext.
   * @param processorUrl - URL or path to the processor bundle.
   */
  static async register(
    context: BaseAudioContext,
    processorUrl: string | URL,
  ): Promise<void> {
    await context.audioWorklet.addModule(processorUrl);
  }

  /**
   * Registers an interpolation strategy installer module in AudioWorkletGlobalScope.
   *
   * @remarks
   * The module should call core registration APIs during evaluation.
   */
  static async registerStrategyModule(
    context: BaseAudioContext,
    strategyModuleUrl: string | URL,
  ): Promise<void> {
    await context.audioWorklet.addModule(strategyModuleUrl);
  }

  private _lastMetrics: ProcessorMetrics | null = null;

  /**
   * Creates a `FormantCorrectionNode` instance.
   * @param options - Node and processor configuration.
   */
  constructor({
    context,
    sampleBufferType,
    interpolationStrategy,
    outputChannelCount,
  }: FormantCorrectionNodeConstructorOptions) {
    super(context, PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [outputChannelCount ?? 2],
      processorOptions: {
        sampleBufferType: sampleBufferType ?? DEFAULT_SAMPLE_BUFFER_TYPE,
        interpolationStrategy,
      },
    });

    this.port.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'metrics') {
        const metrics: ProcessorMetrics = {
          framesBuffered: message.framesBuffered,
          underrunCount: message.underrunCount,
          blockCount: message.blockCount,
          timestamp: performance.now(),
        };
        this._lastMetrics = metrics;
        this.dispatchEvent(new CustomEvent('metrics', { detail: metrics }));
      }
    };
  }

  /**
   * Returns the most recent processor metrics, or `null` before the first report.
   *
   * @remarks
   * Updated every 100 render blocks. Also dispatched as a `metrics` CustomEvent.
   */
  get metrics(): ProcessorMetrics | null {
    return this._lastMetrics;
  }

  /**
   * Pitch multiplier AudioParam (1.0 = original pitch).
   */
  get pitch(): AudioParam {
    return this.parameters.get('pitch')!;
  }

  /**
   * Semitone pitch shift AudioParam (integer steps for musical key changes).
   */
  get pitchSemitones(): AudioParam {
    return this.parameters.get('pitchSemitones')!;
  }

  /**
   * Playback rate AudioParam. Set to match the source node's `playbackRate`
   * for accurate pitch compensation.
   */
  get playbackRate(): AudioParam {
    return this.parameters.get('playbackRate')!;
  }

  /**
   * Formant correction strength AudioParam (0.0–1.0, k-rate).
   *
   * @remarks
   * - `0.0` — no correction; output is identical to `SoundTouchNode`.
   * - `1.0` — full correction; original vocal formants are preserved at the new pitch.
   * - Intermediate values linearly blend the corrected and uncorrected signals.
   */
  get formantStrength(): AudioParam {
    return this.parameters.get('formantStrength')!;
  }

  /**
   * Switches interpolation strategy at runtime in the render-thread processor.
   * @param strategy The new interpolation strategy to use.
   */
  setInterpolationStrategy(
    strategy: RateTransposerInterpolationStrategy,
  ): void {
    this.port.postMessage({
      type: 'set-interpolation-strategy',
      strategy,
    });
  }

  /**
   * Applies a partial params update to the active interpolation strategy.
   * @param params Partial set of parameters to update.
   */
  setInterpolationStrategyParams(
    params: Partial<InterpolationStrategyParams>,
  ): void {
    this.port.postMessage({
      type: 'set-interpolation-strategy-params',
      params,
    });
  }

  /**
   * Applies WSOLA timing parameter updates to the render-thread processor.
   * @param params WSOLA timing parameters.
   */
  setStretchParameters(params: StretchParameters): void {
    this.port.postMessage({
      type: 'set-stretch-parameters',
      params,
    });
  }
}
