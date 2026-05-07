/**
 * Adapter from `AudioBuffer` to the sample-source contract expected by
 * `SimpleFilter`.
 *
 * @remarks
 * Output samples are interleaved stereo. Mono input buffers are duplicated to
 * both output channels.
 */

export default class WebAudioBufferSource {
  /** Source `AudioBuffer` used for extraction. */
  buffer: AudioBuffer;

  /** Current source position in frames. */
  private _position: number;

  /**
   * @param buffer Source `AudioBuffer` to read from.
   */
  constructor(buffer: AudioBuffer) {
    this.buffer = buffer;
    this._position = 0;
  }

  /** True when the source contains at least two channels. */
  get dualChannel(): boolean {
    return this.buffer.numberOfChannels > 1;
  }

  /** Current source position in frames. */
  get position(): number {
    return this._position;
  }

  /**
   * @param value New source position in frames.
   */
  set position(value: number) {
    this._position = value;
  }

  /**
   * Copies frames into `target` as interleaved stereo samples.
   *
   * @param target Destination interleaved stereo array.
   * @param numFrames Number of frames to extract.
   * @param position Source frame offset.
   * @returns Number of frames that can be considered available from the source.
   */
  extract(target: Float32Array, numFrames = 0, position = 0): number {
    this.position = position;
    const left = this.buffer.getChannelData(0);
    const right = this.dualChannel
      ? this.buffer.getChannelData(1)
      : this.buffer.getChannelData(0);

    for (let i = 0; i < numFrames; i++) {
      target[i * 2] = left[i + position];
      target[i * 2 + 1] = right[i + position];
    }
    return Math.min(numFrames, left.length - position);
  }
}
