/**
 * Registered processor identifier used by `AudioWorkletNode`.
 *
 * @remarks
 * This constant is used to identify the SoundTouch processor module when registering and constructing nodes.
 */
export const PROCESSOR_NAME = 'soundtouch-processor';

/**
 * Default internal buffer strategy used when callers do not provide one.
 *
 * @remarks
 * Determines the default buffer implementation for the SoundTouch processing pipeline.
 */
export const DEFAULT_SAMPLE_BUFFER_TYPE = 'circular';
