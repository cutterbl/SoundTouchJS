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

import RateTransposer from './RateTransposer.js';
import type { RateTransposerInterpolationStrategy } from './RateTransposer.js';
import type {
  InterpolationStrategyParams,
  RateTransposerInterpolationStrategyId,
} from './interpolationStrategyRegistry.js';
import {
  createCircularStretchInputBufferAdapter,
  createFifoStretchInputBufferAdapter,
  default as Stretch,
} from './Stretch.js';
import CircularSampleBuffer from './CircularSampleBuffer.js';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import {
  createCircularSampleBufferAdapter,
  createFifoSampleBufferAdapter,
} from './SampleBufferAdapter.js';
import type {
  SampleBuffer,
  SampleBufferFactory,
  SampleBufferType,
} from './SampleBuffer.js';
import testFloatEqual from './testFloatEqual.js';

/**
 * Configuration options for constructing a `SoundTouch` processor.
 *
 * @remarks
 * Allows customization of sample rate, buffer strategy, and interpolation strategy for the SoundTouch engine.
 */
export interface SoundTouchOptions {
  /** Processing sample rate in Hz.
   *
   * @defaultValue 44100
   */
  sampleRate?: number;

  /**
   * Internal sample buffer strategy.
   *
   * @defaultValue 'circular'
   */
  sampleBufferType?: SampleBufferType;

  /**
   * Custom factory for creating all chain buffers.
   *
   * @remarks
   * When provided, this takes precedence over `sampleBufferType` for buffer
   * instantiation.
   */
  sampleBufferFactory?: SampleBufferFactory;

  /**
   * Interpolation strategy used by the rate transposer stage.
   *
   * @defaultValue 'linear'
   */
  interpolationStrategy?: RateTransposerInterpolationStrategy;
}

/**
 * Main processing engine for pitch shifting, tempo adjustment, and rate transposition.
 *
 * @remarks
 * Provides real-time audio manipulation by chaining together rate transposition and time-stretching stages.
 * Exposes properties and methods for controlling pitch, tempo, and rate, as well as buffer access for streaming audio.
 *
 * Set `pitch`, `tempo`, `rate`, or `pitchSemitones` for real-time audio manipulation.
 */
export default class SoundTouch {
  transposer: RateTransposer;
  stretch: Stretch;

  private _sampleRate: number;

  private _sampleBufferType: SampleBufferType;
  private _sampleBufferFactory: SampleBufferFactory;
  private _interpolationStrategy: RateTransposerInterpolationStrategyId;

  private _inputBuffer: SampleBuffer;
  private _intermediateBuffer: SampleBuffer;
  private _outputBuffer: SampleBuffer;

  private _rate: number;
  private _tempo: number;

  virtualPitch: number;
  virtualRate: number;
  virtualTempo: number;

  /**
   * Creates a new SoundTouch processor instance.
   * @param options Construction options for sample rate, buffer strategy, and factories.
   */
  constructor(options: SoundTouchOptions = {}) {
    this._sampleBufferType = options.sampleBufferType ?? 'circular';
    this._sampleBufferFactory =
      options.sampleBufferFactory ??
      (this._sampleBufferType === 'fifo'
        ? () => new FifoSampleBuffer()
        : () => new CircularSampleBuffer());
    this.transposer = new RateTransposer({
      createBuffers: false,
      sampleBufferAdapterFactory:
        this._sampleBufferType === 'circular'
          ? createCircularSampleBufferAdapter
          : createFifoSampleBufferAdapter,
      sampleBufferFactory: this._sampleBufferFactory,
      interpolationStrategy: options.interpolationStrategy,
    });
    this._interpolationStrategy = this.transposer.strategy;
    this.stretch = new Stretch({
      createBuffers: false,
      inputBufferAdapterFactory:
        this._sampleBufferType === 'circular'
          ? createCircularStretchInputBufferAdapter
          : createFifoStretchInputBufferAdapter,
      sampleBufferFactory: this._sampleBufferFactory,
    });

    this._sampleRate = options.sampleRate ?? 44100;
    this.stretch.setParameters(this._sampleRate, 0, 0, 0);

    this._inputBuffer = this._sampleBufferFactory();
    this._intermediateBuffer = this._sampleBufferFactory();
    this._outputBuffer = this._sampleBufferFactory();

    this._rate = 0;
    this._tempo = 0;

    this.virtualPitch = 1.0;
    this.virtualRate = 1.0;
    this.virtualTempo = 1.0;

    this.calculateEffectiveRateAndTempo();
  }

  /**
   * Clears both processing stages and their internal buffers.
   * @remarks
   * Resets the state of the transposer and stretch stages, including all internal buffers.
   */
  clear(): void {
    this.transposer.clear();
    this.stretch.clear();
  }

  /**
   * Creates an independent copy with equivalent runtime configuration.
   */
  clone(): SoundTouch {
    const result = new SoundTouch({
      sampleRate: this._sampleRate,
      sampleBufferType: this._sampleBufferType,
      sampleBufferFactory: this._sampleBufferFactory,
      interpolationStrategy: {
        id: this._interpolationStrategy,
        params: this.transposer.strategyParams,
      },
    });
    result.rate = this.rate;
    result.tempo = this.tempo;
    return result;
  }

  /**
   * Active interpolation strategy id used by the transposer stage.
   * @returns The current interpolation strategy identifier.
   */
  get interpolationStrategy(): RateTransposerInterpolationStrategyId {
    return this._interpolationStrategy;
  }

  /**
   * Active interpolation strategy params used by the transposer stage.
   * @returns The current interpolation strategy parameters.
   */
  get interpolationStrategyParams(): Readonly<InterpolationStrategyParams> {
    return this.transposer.strategyParams;
  }

  /**
   * Switches interpolation strategy at runtime.
   * @param strategy The new interpolation strategy to use.
   */
  setInterpolationStrategy(
    strategy: RateTransposerInterpolationStrategy,
  ): void {
    this.transposer.setInterpolationStrategy(strategy);
    this._interpolationStrategy = this.transposer.strategy;
  }

  /**
   * Applies a partial runtime params update to the current strategy.
   * @param params Partial set of parameters to update.
   */
  setInterpolationStrategyParams(
    params: Partial<InterpolationStrategyParams>,
  ): void {
    this.transposer.setInterpolationStrategyParams(params);
  }

  /**
   * Effective output rate after virtual controls are resolved.
   * @returns The current output rate factor.
   */
  get rate(): number {
    return this._rate;
  }

  /**
   * Sets virtual playback rate and recomputes effective pipeline parameters.
   */
  set rate(rate: number) {
    this.virtualRate = rate;
    this.calculateEffectiveRateAndTempo();
  }

  /**
   * Sets rate using a percent delta where `0` means no change.
   */
  set rateChange(rateChange: number) {
    this._rate = 1.0 + 0.01 * rateChange;
  }

  /**
   * Effective output tempo after virtual controls are resolved.
   * @returns The current output tempo factor.
   */
  get tempo(): number {
    return this._tempo;
  }

  /**
   * Sets virtual tempo and recomputes effective pipeline parameters.
   */
  set tempo(tempo: number) {
    this.virtualTempo = tempo;
    this.calculateEffectiveRateAndTempo();
  }

  /**
   * Sets tempo using a percent delta where `0` means no change.
   */
  set tempoChange(tempoChange: number) {
    this.tempo = 1.0 + 0.01 * tempoChange;
  }

  /**
   * Sets virtual pitch multiplier and updates derived tempo/rate values.
   */
  set pitch(pitch: number) {
    this.virtualPitch = pitch;
    this.calculateEffectiveRateAndTempo();
  }

  /**
   * Sets pitch by octave offset.
   */
  set pitchOctaves(pitchOctaves: number) {
    this.pitch = Math.exp(0.69314718056 * pitchOctaves);
    this.calculateEffectiveRateAndTempo();
  }

  /**
   * Sets pitch by semitone offset.
   */
  set pitchSemitones(pitchSemitones: number) {
    this.pitchOctaves = pitchSemitones / 12.0;
  }

  /**
   * Input buffer for upstream interleaved stereo frames.
   * @returns The input buffer for writing audio frames.
   */
  get inputBuffer(): SampleBuffer {
    return this._inputBuffer;
  }

  /**
   * Output buffer that downstream consumers read from.
   * @returns The output buffer for reading processed audio frames.
   */
  get outputBuffer(): SampleBuffer {
    return this._outputBuffer;
  }

  /**
   * Recomputes effective tempo/rate and rewires the stage ordering when needed.
   * @remarks
   * Updates the internal pipeline to reflect changes in pitch, tempo, or rate.
   */
  calculateEffectiveRateAndTempo(): void {
    const previousTempo = this._tempo;
    const previousRate = this._rate;

    this._tempo = this.virtualTempo / this.virtualPitch;
    this._rate = this.virtualRate * this.virtualPitch;

    if (testFloatEqual(this._tempo, previousTempo)) {
      this.stretch.tempo = this._tempo;
    }
    if (testFloatEqual(this._rate, previousRate)) {
      this.transposer.rate = this._rate;
    }

    if (this._rate > 1.0) {
      if (this._outputBuffer !== this.transposer.outputBuffer) {
        this.stretch.inputBuffer = this._inputBuffer;
        this.stretch.outputBuffer = this._intermediateBuffer;

        this.transposer.inputBuffer = this._intermediateBuffer;
        this.transposer.outputBuffer = this._outputBuffer;
      }
    } else {
      if (this._outputBuffer !== this.stretch.outputBuffer) {
        this.transposer.inputBuffer = this._inputBuffer;
        this.transposer.outputBuffer = this._intermediateBuffer;

        this.stretch.inputBuffer = this._intermediateBuffer;
        this.stretch.outputBuffer = this._outputBuffer;
      }
    }
  }

  /**
   * Runs one processing step through the currently selected stage order.
   * @remarks
   * Processes available frames through the pipeline, updating output buffers.
   */
  process(): void {
    if (this._rate > 1.0) {
      this.stretch.process();
      this.transposer.process();
    } else {
      this.transposer.process();
      this.stretch.process();
    }
  }
}
