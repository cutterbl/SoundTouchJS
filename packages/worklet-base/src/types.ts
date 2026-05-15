import type {
  InterpolationStrategyParams,
  RateTransposerInterpolationStrategy,
  StretchParameters,
} from '@soundtouchjs/core';

/** AudioParam descriptor shape expected by the worklet runtime. */
export interface ParameterDescriptor {
  name: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  automationRate: 'k-rate' | 'a-rate';
}

/**
 * Standard pitch, pitchSemitones, and playbackRate AudioParam descriptors
 * shared by all SoundTouchJS worklet processors.
 */
export const STANDARD_PARAMETER_DESCRIPTORS: ParameterDescriptor[] = [
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

export interface SetInterpolationStrategyMessage {
  type: 'set-interpolation-strategy';
  strategy: RateTransposerInterpolationStrategy;
}

export interface SetInterpolationStrategyParamsMessage {
  type: 'set-interpolation-strategy-params';
  params: Partial<InterpolationStrategyParams>;
}

export interface SetStretchParametersMessage {
  type: 'set-stretch-parameters';
  params: StretchParameters;
}

export type ProcessorMessage =
  | SetInterpolationStrategyMessage
  | SetInterpolationStrategyParamsMessage
  | SetStretchParametersMessage;

/**
 * Data returned by {@link SoundTouchProcessorBase.processCore} after a render block.
 *
 * @remarks
 * Contains routing arrays (for post-extraction overrides), counters, and the
 * RMS/peak values computed during extraction. Subclasses that override
 * `extractSamples` may return `outputRms: 0, outputPeak: 0` when they do not
 * compute those metrics.
 */
export interface ProcessCoreResult {
  /** Number of frames in this render block. */
  frameCount: number;
  /** Number of frames extracted from the output buffer (≤ frameCount). */
  toExtract: number;
  /** Frames available in the output buffer before extraction. */
  available: number;
  /** Left-channel input view for this render block. */
  leftInput: Float32Array;
  /** Right-channel input view (same as leftInput for mono sources). */
  rightInput: Float32Array;
  /** Left-channel output view written during extraction. */
  leftOutput: Float32Array;
  /** Right-channel output view written during extraction. */
  rightOutput: Float32Array;
  /** RMS of the extracted block (both channels, 0 if not computed). */
  outputRms: number;
  /** Peak amplitude of the extracted block (0 if not computed). */
  outputPeak: number;
}
