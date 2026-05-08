/**
 * Adapter from `AudioBuffer` to the sample-source contract expected by `SimpleFilter`.
 *
 * @remarks
 * Converts a Web Audio API `AudioBuffer` into an interleaved stereo sample source for use with SoundTouch processing chains.
 * Output samples are interleaved stereo. Mono input buffers are duplicated to both output channels.
 */

export default class WebAudioBufferSource {
  /**
   * Source `AudioBuffer` used for extraction.
   * @remarks
   * The underlying Web Audio API buffer that provides audio data.
   */
  buffer: AudioBuffer;

  /**
   * Current source position in frames.
   * @remarks
   * Indicates the current read position within the source buffer.
   */
  private _position: number;

  /**
   * @param buffer Source `AudioBuffer` to read from.
   */
  constructor(buffer: AudioBuffer) {
    this.buffer = buffer;
    this._position = 0;
  }

  /**
   * True when the source contains at least two channels.
   * @returns True if the buffer is stereo, false if mono.
   */
  get dualChannel(): boolean {
    return this.buffer.numberOfChannels > 1;
  }

  /**
   * Current source position in frames.
   * @returns The current frame index for reading from the buffer.
   */
  get position(): number {
    return this._position;
  }

  /**
   * Sets the current source position in frames.
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
   * @remarks
   * If the buffer is mono, samples are duplicated to both channels. If stereo, both channels are used as-is.
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
