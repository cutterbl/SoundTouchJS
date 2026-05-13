/**
 * Registered processor identifier used by `AudioWorkletNode`.
 *
 * @remarks
 * Used to identify the phase vocoder processor module when registering and constructing nodes.
 */
export const PROCESSOR_NAME = 'phase-vocoder-processor';

/**
 * Default internal buffer strategy used when callers do not provide one.
 *
 * @remarks
 * Determines the default buffer implementation for the SoundTouch processing pipeline.
 */
export const DEFAULT_SAMPLE_BUFFER_TYPE = 'circular';
