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

import type { SampleBuffer, SampleBufferType } from './SampleBuffer.js';
import type { StretchParameters } from './Stretch.js';

/**
 * Structural interface for a WSOLA time-stretch processing stage.
 *
 * @remarks
 * Implemented by the built-in `Stretch` class. Expose this interface as the type
 * for custom stretch implementations supplied via `SoundTouchOptions.stretchFactory`
 * so callers can swap in a phase vocoder or any other algorithm without subclassing.
 *
 * @example
 * const myFactory: StretchFactory = (sampleRate, opts) => new PhaseVocoderStretch(sampleRate, opts);
 * const st = new SoundTouch({ stretchFactory: myFactory });
 */
export interface StretchPipe {
  /** Input buffer that feeds audio frames into the stretch stage. */
  inputBuffer: SampleBuffer | null;
  /** Output buffer that the stretch stage writes processed frames into. */
  outputBuffer: SampleBuffer | null;
  /** Tempo multiplier (1.0 = original speed). */
  tempo: number;
  /** Minimum number of input frames required before the stage can produce output. */
  readonly sampleReq: number;

  /**
   * Resets all internal state, including the mid-buffer.
   */
  clear(): void;

  /**
   * Resets only the overlap mid-buffer without touching the sample buffers.
   */
  clearMidBuffer(): void;

  /**
   * Runs one processing step, consuming frames from `inputBuffer` and writing to `outputBuffer`.
   */
  process(): void;

  /**
   * Configures the WSOLA timing parameters.
   *
   * @param sampleRate Processing sample rate in Hz.
   * @param sequenceMs Sequence window length in ms; `0` = auto.
   * @param seekWindowMs Seek window length in ms; `0` = auto.
   * @param overlapMs Crossfade overlap length in ms.
   */
  setParameters(
    sampleRate: number,
    sequenceMs: number,
    seekWindowMs: number,
    overlapMs: number,
  ): void;

  /**
   * Applies a partial set of WSOLA timing parameters without requiring all four values.
   *
   * @param params Partial timing parameters to update.
   */
  setStretchParameters(params: StretchParameters): void;

  /**
   * Creates an independent copy with the same configuration and state.
   * @returns A new `StretchPipe` instance cloned from this one.
   */
  clone(): StretchPipe;
}

/**
 * Options passed to a `StretchFactory` when `SoundTouch` creates its stretch stage.
 */
export interface StretchFactoryOptions {
  /** Factory for creating the sample buffers shared with the rest of the pipeline. */
  sampleBufferFactory: () => SampleBuffer;
  /** Buffer strategy identifier (passed through from `SoundTouchOptions`). */
  sampleBufferType: SampleBufferType;
}

/**
 * Factory function that creates a custom stretch processing stage.
 *
 * @remarks
 * Pass this to `SoundTouchOptions.stretchFactory` to replace the built-in WSOLA `Stretch`
 * with a custom implementation (e.g. a phase vocoder).
 *
 * @param sampleRate Processing sample rate in Hz.
 * @param options Additional options supplied by `SoundTouch`.
 * @returns A `StretchPipe` instance ready to be wired into the processing chain.
 */
export type StretchFactory = (
  sampleRate: number,
  options: StretchFactoryOptions,
) => StretchPipe;
