// Ambient type declarations for the AudioWorklet global scope.
// Processors run in AudioWorkletGlobalScope, not the standard browser or
// worker scope, so these globals must be declared explicitly.

interface MessagePort {
  onmessage: ((ev: MessageEvent<any>) => void) | null;
  onmessageerror: ((ev: MessageEvent<any>) => void) | null;
  postMessage(message: unknown, transfer?: unknown[]): void;
  start(): void;
  close(): void;
}

interface MessageEvent<T = unknown> {
  readonly data: T;
  readonly origin: string;
  readonly lastEventId: string;
  readonly source: unknown;
  readonly ports: readonly MessagePort[];
}

interface Console {
  log(...data: unknown[]): void;
  info(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
  debug(...data: unknown[]): void;
}

declare const console: Console;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
  constructor(options?: {
    numberOfInputs?: number;
    numberOfOutputs?: number;
    outputChannelCount?: number[];
    parameterData?: Record<string, number>;
    processorOptions?: unknown;
  });
}

declare function registerProcessor<T extends AudioWorkletProcessor>(
  name: string,
  processorCtor: new (...args: any[]) => T,
): void;

declare const sampleRate: number;
declare const currentFrame: number;
declare const currentTime: number;
