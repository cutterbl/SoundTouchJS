/**
 * Adapter from AudioBuffer to internal sample source interface.
 * Used for feeding audio data into SoundTouch processing pipeline.
 */
// ...existing code...

export default class WebAudioBufferSource {
  buffer: AudioBuffer;
  private _position: number;

  constructor(buffer: AudioBuffer) {
    this.buffer = buffer;
    this._position = 0;
  }

  get dualChannel(): boolean {
    return this.buffer.numberOfChannels > 1;
  }

  get position(): number {
    return this._position;
  }

  set position(value: number) {
    this._position = value;
  }

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
