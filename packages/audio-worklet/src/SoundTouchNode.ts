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
 * Emitted every 100 render blocks via the `metrics` CustomEvent on `SoundTouchNode`.
 * Access the latest snapshot via `SoundTouchNode.metrics`.
 */
export interface ProcessorMetrics {
  /** Frames available in the output buffer at the last render block. */
  framesBuffered: number;
  /** Cumulative render blocks where the output buffer had fewer frames than requested. */
  underrunCount: number;
  /** Total render blocks processed since the processor was created. */
  blockCount: number;
  /** `performance.now()` timestamp recorded on the main thread when the metrics arrived. */
  timestamp: DOMHighResTimeStamp;
}

/**
 * Construction options for `SoundTouchNode`.
 *
 * @remarks
 * Used to configure the AudioWorkletNode and its processor, including buffer strategy and interpolation strategy.
 */
export interface SoundTouchNodeOptions {
  /**
   * Optional processor URL retained for caller-side convenience.
   *
   * @remarks
   * Module registration is still performed through `SoundTouchNode.register`.
   */
  processorUrl?: string | URL;

  /**
   * Internal sample buffer strategy used inside the render-thread processor.
   */
  sampleBufferType?: SampleBufferType;

  /**
   * Interpolation strategy used by the internal rate transposer.
   */
  interpolationStrategy?: RateTransposerInterpolationStrategy;
}

/**
 * Construction options for SoundTouchNode constructor.
 * Extends SoundTouchNodeOptions with required context.
 */
export interface SoundTouchNodeConstructorOptions extends SoundTouchNodeOptions {
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
   * Note: mono input is always supported regardless of this setting —
   * the processor duplicates a single input channel to both sides of
   * the stereo pipeline automatically.
   */
  outputChannelCount?: 1 | 2;
}

/**
 * Main-thread AudioWorkletNode wrapper for SoundTouch audio processing.
 *
 * @remarks
 * Provides AudioParam accessors for pitch, tempo, rate, pitchSemitones, and playbackRate. Communicates with the render-thread processor for real-time audio transformation.
 *
 * @example
 * const stNode = new SoundTouchNode({ context: audioCtx });
 * stNode.pitch.value = 1.2;
 * stNode.tempo.value = 0.8;
 * stNode.pitchSemitones.value = -3;
 */
export class SoundTouchNode extends AudioWorkletNode {
  /**
   * The registered processor name for this node type.
   */
  static readonly processorName = PROCESSOR_NAME;

  /**
   * Registers the SoundTouch processor module with the given AudioContext.
   *
   * @remarks
   * Must be called before creating SoundTouchNode instances. Loads the processor script into the AudioWorklet.
   *
   * @param context - The AudioContext or OfflineAudioContext
   * @param processorUrl - URL or path to the processor script
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
   * Creates a SoundTouchNode instance.
   * @param options - Node and processor configuration.
   */
  constructor({
    context,
    sampleBufferType,
    interpolationStrategy,
    outputChannelCount,
  }: SoundTouchNodeConstructorOptions) {
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
   * Returns the most recent processor metrics snapshot, or `null` if no metrics have been received yet.
   *
   * @remarks
   * Updated every 100 render blocks by the processor. Also dispatched as a `metrics` CustomEvent.
   *
   * @example
   * stNode.addEventListener('metrics', (e) => {
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
   * playbackRate so the processor can compensate pitch for tempo changes.
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
   * Applies a partial set of WSOLA timing parameters to the render-thread processor.
   *
   * @remarks
   * The update is queued and applied at the next render-block boundary. Only the
   * provided fields are updated; omitted fields remain unchanged. Pass `sequenceMs: 0`
   * or `seekWindowMs: 0` to switch that dimension back to auto-calculation.
   *
   * @param params Partial WSOLA timing parameters to apply.
   *
   * @example
   * stNode.setStretchParameters({ overlapMs: 12, quickSeek: false });
   */
  setStretchParameters(params: StretchParameters): void {
    this.port.postMessage({
      type: 'set-stretch-parameters',
      params,
    });
  }
}
