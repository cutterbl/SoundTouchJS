import type { SampleBuffer } from './SampleBuffer.js';

const SAMPLES_PER_FRAME = 2;

/**
 * Circular frame buffer for interleaved stereo audio samples.
 *
 * @remarks
 * This structure keeps a movable read cursor and appends at the logical end.
 * Capacity grows automatically when needed while preserving frame order.
 */
export default class CircularSampleBuffer implements SampleBuffer {
  private _buffer: Float32Array;
  private _capacityFrames: number;
  private _readFrame: number;
  private _frameCount: number;

  /**
   * @param capacityFrames Initial frame capacity before automatic growth.
   */
  constructor(capacityFrames = 2048) {
    const normalizedCapacity = Math.max(1, Math.floor(capacityFrames));
    this._capacityFrames = normalizedCapacity;
    this._buffer = new Float32Array(normalizedCapacity * SAMPLES_PER_FRAME);
    this._readFrame = 0;
    this._frameCount = 0;
  }

  /** Allocated capacity expressed in frames. */
  get capacityFrames(): number {
    return this._capacityFrames;
  }

  /** Number of buffered frames currently readable. */
  get frameCount(): number {
    return this._frameCount;
  }

  /** Clears the buffer without shrinking allocated capacity. */
  clear(): void {
    this._readFrame = 0;
    this._frameCount = 0;
  }

  /**
   * Ensures the internal storage can hold at least `minCapacityFrames`.
   *
   * @param minCapacityFrames Minimum frame capacity required.
   */
  ensureCapacity(minCapacityFrames: number): void {
    const normalizedMinCapacityFrames = Math.max(
      0,
      Math.floor(minCapacityFrames),
    );
    if (normalizedMinCapacityFrames <= this._capacityFrames) {
      return;
    }

    const nextCapacity = Math.max(
      normalizedMinCapacityFrames,
      this._capacityFrames * 2,
      this._capacityFrames + 1024,
    );

    const nextBuffer = new Float32Array(nextCapacity * SAMPLES_PER_FRAME);

    for (let frame = 0; frame < this._frameCount; frame += 1) {
      const sourceFrame = (this._readFrame + frame) % this._capacityFrames;
      const sourceIndex = sourceFrame * SAMPLES_PER_FRAME;
      const destIndex = frame * SAMPLES_PER_FRAME;
      nextBuffer[destIndex] = this._buffer[sourceIndex];
      nextBuffer[destIndex + 1] = this._buffer[sourceIndex + 1];
    }

    this._buffer = nextBuffer;
    this._capacityFrames = nextCapacity;
    this._readFrame = 0;
  }

  /**
   * Appends source frames to the end of the ring.
   *
   * @param source Interleaved stereo source samples.
   * @param sourceFrameOffset Source offset in frames.
   * @param frameCount Number of frames to append; defaults to all complete
   * remaining frames.
   */
  pushSamples(
    source: Float32Array,
    sourceFrameOffset = 0,
    frameCount = 0,
  ): void {
    const normalizedSourceFrameOffset = Math.max(
      0,
      Math.floor(sourceFrameOffset),
    );
    const sourceStartSample = normalizedSourceFrameOffset * SAMPLES_PER_FRAME;
    const availableFrames = Math.max(
      0,
      Math.floor((source.length - sourceStartSample) / SAMPLES_PER_FRAME),
    );
    const requestedFrames = frameCount > 0 ? Math.floor(frameCount) : 0;
    const framesToWrite =
      requestedFrames > 0
        ? Math.min(requestedFrames, availableFrames)
        : availableFrames;

    if (framesToWrite <= 0) {
      return;
    }

    this.ensureCapacity(this._frameCount + framesToWrite);

    const writeFrame =
      (this._readFrame + this._frameCount) % this._capacityFrames;

    for (let frame = 0; frame < framesToWrite; frame += 1) {
      const sourceIndex = sourceStartSample + frame * SAMPLES_PER_FRAME;
      const destFrame = (writeFrame + frame) % this._capacityFrames;
      const destIndex = destFrame * SAMPLES_PER_FRAME;
      this._buffer[destIndex] = source[sourceIndex];
      this._buffer[destIndex + 1] = source[sourceIndex + 1];
    }

    this._frameCount += framesToWrite;
  }

  /**
   * Contract alias for `pushSamples`.
   *
   * @param source Interleaved stereo source samples.
   * @param sourceFrameOffset Source offset in frames.
   * @param frameCount Number of frames to append.
   */
  putSamples(
    source: Float32Array,
    sourceFrameOffset = 0,
    frameCount = 0,
  ): void {
    this.pushSamples(source, sourceFrameOffset, frameCount);
  }

  /**
   * Extracts frames from the ring into `target`.
   *
   * @param target Destination array for interleaved stereo samples.
   * @param sourceFrameOffset Read offset in frames.
   * @param frameCount Number of frames requested.
   * @param consume When true, consumed frames are dropped from the front.
   * @returns Number of frames copied.
   */
  extract(
    target: Float32Array,
    sourceFrameOffset = 0,
    frameCount = 0,
    consume = false,
  ): number {
    const normalizedSourceFrameOffset = Math.max(
      0,
      Math.floor(sourceFrameOffset),
    );
    const requestedFrames = frameCount > 0 ? Math.floor(frameCount) : 0;
    const framesAvailable = Math.max(
      0,
      this._frameCount - normalizedSourceFrameOffset,
    );
    const framesToRead =
      requestedFrames > 0
        ? Math.min(requestedFrames, framesAvailable)
        : framesAvailable;

    if (framesToRead <= 0) {
      return 0;
    }

    for (let frame = 0; frame < framesToRead; frame += 1) {
      const sourceFrame =
        (this._readFrame + normalizedSourceFrameOffset + frame) %
        this._capacityFrames;
      const sourceIndex = sourceFrame * SAMPLES_PER_FRAME;
      const targetIndex = frame * SAMPLES_PER_FRAME;
      target[targetIndex] = this._buffer[sourceIndex];
      target[targetIndex + 1] = this._buffer[sourceIndex + 1];
    }

    if (consume) {
      const framesToDrop = normalizedSourceFrameOffset + framesToRead;
      this.dropFrames(framesToDrop);
    }

    return framesToRead;
  }

  /**
   * Reads a single sample value by logical sample index.
   *
   * @param sampleIndex Logical sample index relative to the readable head.
   * @returns Sample value, or `0` when the index falls outside readable data.
   */
  readSample(sampleIndex: number): number {
    const normalizedSampleIndex = Math.max(0, Math.floor(sampleIndex));
    const frameOffset = Math.floor(normalizedSampleIndex / SAMPLES_PER_FRAME);
    if (frameOffset >= this._frameCount) {
      return 0;
    }

    const channelOffset = normalizedSampleIndex % SAMPLES_PER_FRAME;
    const sourceFrame = (this._readFrame + frameOffset) % this._capacityFrames;
    const sourceIndex = sourceFrame * SAMPLES_PER_FRAME + channelOffset;
    return this._buffer[sourceIndex] ?? 0;
  }

  /**
   * Drops frames from the front of the ring.
   *
   * @param frameCount Maximum number of frames to remove.
   * @returns Number of frames removed.
   */
  dropFrames(frameCount: number): number {
    const normalizedFrameCount = Math.max(0, Math.floor(frameCount));
    const framesToDrop = Math.max(
      0,
      Math.min(normalizedFrameCount, this._frameCount),
    );
    if (framesToDrop === 0) {
      return 0;
    }

    this._readFrame = (this._readFrame + framesToDrop) % this._capacityFrames;
    this._frameCount -= framesToDrop;

    if (this._frameCount === 0) {
      this._readFrame = 0;
    }

    return framesToDrop;
  }

  /**
   * Contract alias for `dropFrames`.
   *
   * @param frameCount Number of frames to consume.
   */
  receive(frameCount = this._frameCount): void {
    this.dropFrames(frameCount);
  }
}
