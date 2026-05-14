/**
 * Common contract implemented by all interleaved stereo sample buffers.
 *
 * @remarks
 * Defines the interface for stereo sample buffers, where each frame consists of two contiguous float values (left, right).
 * Implementations must provide methods for appending, extracting, and consuming frames.
 */
export interface SampleBuffer {
  /** Number of currently readable frames in the buffer. */
  readonly frameCount: number;

  /** Removes all buffered frames and resets internal read/write state. */
  clear(): void;

  /**
   * Appends frames to the end of the buffer.
   *
   * @param samples Interleaved stereo source samples.
   * @param position Source offset in frames.
   * @param numFrames Number of frames to append. If omitted, appends all
   * remaining complete frames from `position`.
   */
  putSamples(
    samples: Float32Array,
    position?: number,
    numFrames?: number,
  ): void;

  /**
   * Copies frames out of the buffer into `output` without necessarily consuming
   * them.
   *
   * @param output Target array that receives interleaved stereo samples.
   * @param position Read offset in frames.
   * @param numFrames Number of frames to copy. If omitted, copies all available
   * frames from `position`.
   */
  extract(output: Float32Array, position?: number, numFrames?: number): void;

  /**
   * Consumes frames from the start of the buffer.
   *
   * @param numFrames Number of frames to drop. If omitted, consumes all frames.
   */
  receive(numFrames?: number): void;
}

/**
 * Selects the internal buffering strategy used by SoundTouch processing stages.
 *
 * @remarks
 * Determines which buffer implementation is used for internal audio processing chains.
 */
export type SampleBufferType = 'circular' | 'fifo';

/**
 * Factory used to construct sample buffers for processing chains.
 *
 * @remarks
 * Returns a new instance of a class implementing the SampleBuffer interface.
 */
export type SampleBufferFactory = () => SampleBuffer;
