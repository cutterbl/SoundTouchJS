import CircularSampleBuffer from './CircularSampleBuffer.js';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import type { SampleBuffer } from './SampleBuffer.js';

/**
 * Read/consume adapter used by processors that need consistent extraction
 * semantics regardless of concrete input buffer implementation.
 */
export interface SampleBufferAdapter {
  /** Number of frames currently available through the adapter view. */
  readonly frameCount: number;

  /** Clears all adapter-local state and temporary storage. */
  clear(): void;

  /**
   * Synchronizes adapter state from the latest input buffer contents.
   *
   * @param inputBuffer Source buffer for adapter reads.
   */
  syncFromInputBuffer(inputBuffer: SampleBuffer): void;

  /**
   * Copies frames from adapter storage into `target`.
   *
   * @param target Target interleaved stereo array.
   * @param sourceFrameOffset Source offset in frames.
   * @param frameCount Maximum number of frames to copy.
   * @returns Number of frames copied.
   */
  extract(
    target: Float32Array,
    sourceFrameOffset: number,
    frameCount: number,
  ): number;

  /**
   * Consumes frames previously exposed through the adapter.
   *
   * @param frameCount Number of frames to consume.
   */
  receive(frameCount: number): void;
}

/** Factory for creating adapter instances. */
export type SampleBufferAdapterFactory = () => SampleBufferAdapter;

class FifoSampleBufferAdapter implements SampleBufferAdapter {
  private inputBuffer: SampleBuffer | null;

  constructor() {
    this.inputBuffer = null;
  }

  get frameCount(): number {
    return this.inputBuffer?.frameCount ?? 0;
  }

  clear(): void {
    this.inputBuffer = null;
  }

  syncFromInputBuffer(inputBuffer: SampleBuffer): void {
    this.inputBuffer = inputBuffer;
  }

  extract(
    target: Float32Array,
    sourceFrameOffset: number,
    frameCount: number,
  ): number {
    const buffer = this.inputBuffer;
    if (buffer === null) {
      return 0;
    }

    const availableFrames = Math.max(0, buffer.frameCount - sourceFrameOffset);
    const framesToExtract = Math.max(0, Math.min(frameCount, availableFrames));
    if (framesToExtract === 0) {
      return 0;
    }

    buffer.extract(target, sourceFrameOffset, framesToExtract);
    return framesToExtract;
  }

  receive(frameCount: number): void {
    this.inputBuffer?.receive(frameCount);
  }
}

class CircularSampleBufferAdapter implements SampleBufferAdapter {
  private readonly circularBuffer: CircularSampleBuffer;
  private scratch: Float32Array;

  constructor() {
    this.circularBuffer = new CircularSampleBuffer();
    this.scratch = new Float32Array(0);
  }

  get frameCount(): number {
    return this.circularBuffer.frameCount;
  }

  clear(): void {
    this.circularBuffer.clear();
  }

  syncFromInputBuffer(inputBuffer: SampleBuffer): void {
    if (inputBuffer instanceof FifoSampleBuffer) {
      const frames = inputBuffer.frameCount;
      if (frames === 0) {
        return;
      }

      this.circularBuffer.pushSamples(
        inputBuffer.vector,
        inputBuffer.position,
        frames,
      );
      inputBuffer.receive(frames);
      return;
    }

    const frames = inputBuffer.frameCount;
    if (frames === 0) {
      return;
    }

    const sampleCount = frames * 2;
    if (this.scratch.length < sampleCount) {
      this.scratch = new Float32Array(sampleCount);
    }

    inputBuffer.extract(this.scratch, 0, frames);
    this.circularBuffer.pushSamples(this.scratch, 0, frames);
    inputBuffer.receive(frames);
  }

  extract(
    target: Float32Array,
    sourceFrameOffset: number,
    frameCount: number,
  ): number {
    return this.circularBuffer.extract(
      target,
      sourceFrameOffset,
      frameCount,
      false,
    );
  }

  receive(frameCount: number): void {
    this.circularBuffer.dropFrames(frameCount);
  }
}

/** Creates an adapter that reads directly from any `SampleBuffer` contract. */
export const createFifoSampleBufferAdapter: SampleBufferAdapterFactory = () =>
  new FifoSampleBufferAdapter();

/**
 * Creates an adapter that stages source frames in a circular buffer for
 * efficient repeated reads.
 */
export const createCircularSampleBufferAdapter: SampleBufferAdapterFactory =
  () => new CircularSampleBufferAdapter();
