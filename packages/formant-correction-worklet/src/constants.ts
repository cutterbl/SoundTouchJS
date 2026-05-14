/**
 * Registered processor identifier used by `AudioWorkletNode`.
 */
export const PROCESSOR_NAME = 'formant-correction-processor';

/**
 * Default internal buffer strategy used when callers do not provide one.
 */
export const DEFAULT_SAMPLE_BUFFER_TYPE = 'circular';

/** LPC predictor order used for formant envelope estimation. */
export const LPC_ORDER = 16;

/** Analysis window length in samples used to compute LPC coefficients. */
export const LPC_WINDOW = 512;
