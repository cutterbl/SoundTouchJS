/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
  InterpolationStrategyParams,
  RateTransposerInterpolationStrategy,
  SampleBufferType,
  StretchParameters,
} from '@soundtouchjs/core';
export type { StretchParameters } from '@soundtouchjs/core';
import type {
  PhaseVocoderFftSize,
  PhaseVocoderOverlapFactor,
} from '@soundtouchjs/stretch-phase-vocoder';
import { DEFAULT_SAMPLE_BUFFER_TYPE, PROCESSOR_NAME } from './constants.js';

/**
 * Snapshot of processor performance metrics received from the render thread.
 *
 * @remarks
 * Emitted every 100 render blocks via the `metrics` CustomEvent on `PhaseVocoderNode`.
 * Access the latest snapshot via `PhaseVocoderNode.metrics`.
 */
export interface ProcessorMetrics {
  /** Frames available in the output buffer at the last render block. */
  framesBuffered: number;
  /** Cumulative render blocks where the output buffer had fewer frames than requested. */
  underrunCount: number;
  /** Total render blocks processed since the processor was created. */
  blockCount: number;
  /** RMS of output block (last 128 frames, both channels averaged) */
  outputRms: number;
  /** Peak of output block (last 128 frames, both channels) */
  outputPeak: number;
  /** `performance.now()` timestamp recorded on the main thread when the metrics arrived. */
  timestamp: DOMHighResTimeStamp;
}

/**
 * Construction options for `PhaseVocoderNode`.
 *
 * @remarks
 * Used to configure the AudioWorkletNode and its processor, including buffer strategy,
 * interpolation strategy, and phase vocoder FFT parameters.
 */
export interface PhaseVocoderNodeOptions {
  /**
   * Internal sample buffer strategy used inside the render-thread processor.
   */
  sampleBufferType?: SampleBufferType;

  /**
   * Interpolation strategy used by the internal rate transposer.
   */
  interpolationStrategy?: RateTransposerInterpolationStrategy;

  /**
   * FFT frame size for the phase vocoder.
   *
   * @remarks
   * Larger values give better frequency resolution but higher latency.
   * @defaultValue 2048
   */
  fftSize?: PhaseVocoderFftSize;

  /**
   * Overlap factor for the phase vocoder.
   *
   * @remarks
   * Higher values produce smoother output at the cost of more computation.
   * @defaultValue 4
   */
  overlapFactor?: PhaseVocoderOverlapFactor;
}

/**
 * Construction options for `PhaseVocoderNode` constructor.
 * Extends `PhaseVocoderNodeOptions` with the required AudioContext.
 */
export interface PhaseVocoderNodeConstructorOptions extends PhaseVocoderNodeOptions {
  /**
   * The AudioContext or OfflineAudioContext.
   * @remarks
   * Required for node construction; determines the audio graph context.
   */
  context: BaseAudioContext;

  /**
   * Number of output channels. Defaults to `2` (stereo).
   *
   * @remarks
   * Set to `1` when connecting to a mono destination or a downstream
   * node that only accepts a single channel. The processor always
   * processes interleaved stereo internally; setting this to `1` tells
   * the Web Audio graph to mix down to mono on the output side.
   *
   * Mono input is always supported — the processor duplicates a single
   * input channel to both sides of the stereo pipeline automatically.
   */
  outputChannelCount?: 1 | 2;
}

/**
 * Main-thread AudioWorkletNode wrapper using a phase vocoder time-stretch algorithm.
 *
 * @remarks
 * Wraps `PhaseVocoderProcessor` in the render thread. Provides the same AudioParam
 * accessors and runtime control methods as `SoundTouchNode`, with additional
 * `fftSize` and `overlapFactor` constructor options for tuning the FFT stage.
 *
 * The phase vocoder produces smoother results than WSOLA at extreme ratios (> 2×)
 * at the cost of higher per-frame computation and inherent `fftSize`-sample latency.
 *
 * @example
 * ```ts
 * import { PhaseVocoderNode } from '@soundtouchjs/phase-vocoder-worklet';
 *
 * await PhaseVocoderNode.register(audioCtx, processorUrl);
 * const node = new PhaseVocoderNode({ context: audioCtx, fftSize: 1024 });
 * node.pitch.value = 1.5;
 * ```
 */
export class PhaseVocoderNode extends AudioWorkletNode {
  /**
   * The registered processor name for this node type.
   */
  static readonly processorName = PROCESSOR_NAME;

  /**
   * Registers the phase vocoder processor module with the given AudioContext.
   *
   * @remarks
   * Must be called before creating `PhaseVocoderNode` instances. Loads the
   * processor script into the AudioWorklet global scope.
   *
   * @param context - The AudioContext or OfflineAudioContext
   * @param processorUrl - URL or path to the processor bundle
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
   * Loads a strategy plugin for use in the render-thread processor.
   */
  static async registerStrategyModule(
    context: BaseAudioContext,
    strategyModuleUrl: string | URL,
  ): Promise<void> {
    await context.audioWorklet.addModule(strategyModuleUrl);
  }

  private _lastMetrics: ProcessorMetrics | null = null;

  /**
   * Creates a `PhaseVocoderNode` instance.
   * @param options - Node and processor configuration.
   */
  constructor({
    context,
    sampleBufferType,
    interpolationStrategy,
    fftSize,
    overlapFactor,
    outputChannelCount,
  }: PhaseVocoderNodeConstructorOptions) {
    super(context, PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [outputChannelCount ?? 2],
      processorOptions: {
        sampleBufferType: sampleBufferType ?? DEFAULT_SAMPLE_BUFFER_TYPE,
        interpolationStrategy,
        fftSize: fftSize ?? 2048,
        overlapFactor: overlapFactor ?? 4,
      },
    });

    this.port.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'metrics') {
        const metrics: ProcessorMetrics = {
          framesBuffered: message.framesBuffered,
          underrunCount: message.underrunCount,
          blockCount: message.blockCount,
          outputRms: message.outputRms,
          outputPeak: message.outputPeak,
          timestamp: performance.now(),
        };
        this._lastMetrics = metrics;
        this.dispatchEvent(new CustomEvent('metrics', { detail: metrics }));
      }
    };
  }

  /**
   * Returns the most recent processor metrics snapshot, or `null` if no metrics have been received yet.
   *
   * @remarks
   * Updated every 100 render blocks by the processor. Also dispatched as a `metrics` CustomEvent.
   *
   * @example
   * node.addEventListener('metrics', (e) => {
   *   console.log((e as CustomEvent<ProcessorMetrics>).detail.underrunCount);
   * });
   */
  get metrics(): ProcessorMetrics | null {
    return this._lastMetrics;
  }

  /**
   * Pitch multiplier AudioParam (1.0 = original pitch).
   * @returns The AudioParam controlling pitch.
   */
  get pitch(): AudioParam {
    return this.parameters.get('pitch')!;
  }

  /**
   * Pitch shift in semitones AudioParam (integer steps for musical key changes).
   * @returns The AudioParam controlling pitch in semitones.
   */
  get pitchSemitones(): AudioParam {
    return this.parameters.get('pitchSemitones')!;
  }

  /**
   * Playback rate AudioParam. Set this to the same value as the source node's
   * `playbackRate` so the processor can compensate pitch for tempo changes.
   * @returns The AudioParam controlling playback rate.
   */
  get playbackRate(): AudioParam {
    return this.parameters.get('playbackRate')!;
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
   *
   * @remarks
   * The update is queued and applied at the next render-block boundary. For the
   * phase vocoder, these parameters are no-ops (timing is controlled by `fftSize`
   * and `overlapFactor`). This method exists for API parity with `SoundTouchNode`.
   *
   * @param params WSOLA timing parameters to apply.
   */
  setStretchParameters(params: StretchParameters): void {
    this.port.postMessage({
      type: 'set-stretch-parameters',
      params,
    });
  }
}
