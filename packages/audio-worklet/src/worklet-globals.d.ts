// AudioWorkletProcessor ambient types for the worklet global scope.
// These are not included in the standard DOM lib and must be declared manually.

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void;

declare const sampleRate: number;
declare const currentFrame: number;
declare const currentTime: number;
