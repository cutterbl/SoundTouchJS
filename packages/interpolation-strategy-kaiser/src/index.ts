export type BuiltInInterpolationStrategy = 'linear' | 'lanczos8';

export interface InterpolationKernel {
  (
    src: Float32Array,
    srcOffset: number,
    numFrames: number,
    position: number,
    channel: 0 | 1,
    state: unknown,
  ): number;
  createState?: () => unknown;
}

export interface InterpolationStrategyRegistration {
  readonly id: string;
  readonly baseStrategy?: BuiltInInterpolationStrategy;
  readonly kernel?: InterpolationKernel;
  readonly defaultParams?: Record<string, number>;
  readonly normalizeParams?: (
    params: Partial<Record<string, number>> | undefined,
    defaults: Record<string, number>,
  ) => Record<string, number>;
  readonly applyParams?: (
    state: unknown,
    params: Record<string, number>,
  ) => void;
}

export interface InterpolationStrategyRegistrar {
  registerInterpolationStrategy: (
    registration: InterpolationStrategyRegistration,
  ) => void;
}

interface KaiserKernelState {
  prevSampleL: number;
  prevSampleR: number;
  params: KaiserStrategyParams;
}

export interface KaiserStrategyParams extends Record<string, number> {
  radius: number;
  beta: number;
}

const KAISER_DEFAULT_PARAMS: KaiserStrategyParams = {
  radius: 4,
  beta: 8.6,
};

function normalizeKaiserParams(
  params: Partial<Record<string, number>> | undefined,
  defaults: Record<string, number>,
): Record<string, number> {
  const merged = {
    ...defaults,
    ...(params ?? {}),
  };

  const radius = Math.max(
    2,
    Math.min(16, Math.round(merged['radius'] ?? defaults['radius'] ?? 4)),
  );
  const beta = Math.max(0, Math.min(20, merged['beta'] ?? defaults['beta'] ?? 8.6));

  return { radius, beta };
}

function applyKaiserParams(
  state: unknown,
  params: Record<string, number>,
): void {
  if (typeof state !== 'object' || state === null) {
    return;
  }
  const record = state as KaiserKernelState;
  record.params = {
    radius: Math.max(2, Math.round(params['radius'] ?? 4)),
    beta: Math.max(0, Math.min(20, params['beta'] ?? 8.6)),
  };
}

function readFrameSample(
  src: Float32Array,
  srcOffset: number,
  numFrames: number,
  frameIndex: number,
  channel: 0 | 1,
  state: KaiserKernelState,
): number {
  if (frameIndex < 0) {
    return channel === 0 ? state.prevSampleL : state.prevSampleR;
  }

  if (frameIndex >= numFrames) {
    const edgeIndex = srcOffset + 2 * (numFrames - 1) + channel;
    return src[edgeIndex];
  }

  return src[srcOffset + 2 * frameIndex + channel];
}

function normalizedSinc(x: number): number {
  if (x === 0) {
    return 1;
  }
  const value = Math.PI * x;
  return Math.sin(value) / value;
}

function besselI0(x: number): number {
  const halfSquared = (x * x) / 4;
  let sum = 1;
  let term = 1;

  for (let index = 1; index <= 32; index += 1) {
    term *= halfSquared / (index * index);
    sum += term;

    if (term < 1e-12) {
      break;
    }
  }

  return sum;
}

function kaiserWindow(
  distance: number,
  radius: number,
  beta: number,
  denominator: number,
): number {
  const absDistance = Math.abs(distance);
  if (absDistance >= radius) {
    return 0;
  }

  if (beta === 0) {
    return 1;
  }

  const ratio = absDistance / radius;
  const shape = Math.sqrt(1 - ratio * ratio);
  return besselI0(beta * shape) / denominator;
}

export const kaiserKernel: InterpolationKernel = (
  src,
  srcOffset,
  numFrames,
  position,
  channel,
  state,
) => {
  const kernelState = state as KaiserKernelState;
  const { radius, beta } = kernelState.params;
  const denominator = besselI0(beta);
  const center = Math.floor(position);
  const start = center - (radius - 1);
  const end = center + radius;

  let numerator = 0;
  let weightSum = 0;

  for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {
    const distance = position - sampleIndex;
    const window = kaiserWindow(distance, radius, beta, denominator);
    const weight = normalizedSinc(distance) * window;

    numerator +=
      readFrameSample(
        src,
        srcOffset,
        numFrames,
        sampleIndex,
        channel,
        kernelState,
      ) * weight;
    weightSum += weight;
  }

  if (Math.abs(weightSum) < 1e-12) {
    return readFrameSample(
      src,
      srcOffset,
      numFrames,
      Math.round(position),
      channel,
      kernelState,
    );
  }

  return numerator / weightSum;
};

kaiserKernel.createState = () => ({
  prevSampleL: 0,
  prevSampleR: 0,
  params: { ...KAISER_DEFAULT_PARAMS },
});

export const kaiserStrategy: InterpolationStrategyRegistration = {
  id: 'kaiser8',
  baseStrategy: 'linear',
  kernel: kaiserKernel,
  defaultParams: KAISER_DEFAULT_PARAMS,
  normalizeParams: normalizeKaiserParams,
  applyParams: applyKaiserParams,
};

export function registerKaiserStrategy(
  registry: InterpolationStrategyRegistrar,
): void {
  registry.registerInterpolationStrategy(kaiserStrategy);
}
