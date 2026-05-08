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

interface BlackmanKernelState {
  prevSampleL: number;
  prevSampleR: number;
  params: BlackmanStrategyParams;
}

export interface BlackmanStrategyParams extends Record<string, number> {
  radius: number;
}

const BLACKMAN_DEFAULT_PARAMS: BlackmanStrategyParams = {
  radius: 4,
};

function normalizeBlackmanParams(
  params: Partial<Record<string, number>> | undefined,
  defaults: Record<string, number>,
): Record<string, number> {
  const merged = {
    ...defaults,
    ...(params ?? {}),
  };
  const radius = Math.max(
    2,
    Math.min(8, Math.round(merged['radius'] ?? defaults['radius'] ?? 4)),
  );

  return { radius };
}

function applyBlackmanParams(
  state: unknown,
  params: Record<string, number>,
): void {
  if (typeof state !== 'object' || state === null) {
    return;
  }
  const record = state as BlackmanKernelState;
  record.params = {
    radius: Math.max(2, Math.round(params['radius'] ?? 4)),
  };
}

function readFrameSample(
  src: Float32Array,
  srcOffset: number,
  numFrames: number,
  frameIndex: number,
  channel: 0 | 1,
  state: BlackmanKernelState,
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

function blackmanWindow(distance: number, radius: number): number {
  const absDistance = Math.abs(distance);
  if (absDistance >= radius) {
    return 0;
  }

  const ratio = absDistance / radius;
  return (
    0.42 +
    0.5 * Math.cos(Math.PI * ratio) +
    0.08 * Math.cos(2 * Math.PI * ratio)
  );
}

function blackmanWeight(distance: number, radius: number): number {
  return normalizedSinc(distance) * blackmanWindow(distance, radius);
}

export const blackmanKernel: InterpolationKernel = (
  src,
  srcOffset,
  numFrames,
  position,
  channel,
  state,
) => {
  const kernelState = state as BlackmanKernelState;
  const radius = kernelState.params.radius;
  const center = Math.floor(position);
  const start = center - (radius - 1);
  const end = center + radius;

  let numerator = 0;
  let denominator = 0;

  for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {
    const distance = position - sampleIndex;
    const weight = blackmanWeight(distance, radius);
    numerator +=
      readFrameSample(
        src,
        srcOffset,
        numFrames,
        sampleIndex,
        channel,
        kernelState,
      ) * weight;
    denominator += weight;
  }

  if (Math.abs(denominator) < 1e-12) {
    return readFrameSample(
      src,
      srcOffset,
      numFrames,
      Math.round(position),
      channel,
      kernelState,
    );
  }

  return numerator / denominator;
};

blackmanKernel.createState = () => ({
  prevSampleL: 0,
  prevSampleR: 0,
  params: { ...BLACKMAN_DEFAULT_PARAMS },
});

export const blackmanStrategy: InterpolationStrategyRegistration = {
  id: 'blackman8',
  baseStrategy: 'linear',
  kernel: blackmanKernel,
  defaultParams: BLACKMAN_DEFAULT_PARAMS,
  normalizeParams: normalizeBlackmanParams,
  applyParams: applyBlackmanParams,
};

export function registerBlackmanStrategy(
  registry: InterpolationStrategyRegistrar,
): void {
  registry.registerInterpolationStrategy(blackmanStrategy);
}
