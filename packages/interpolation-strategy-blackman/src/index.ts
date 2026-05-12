export type BuiltInInterpolationStrategy = 'linear' | 'lanczos';

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
  readonly defaultParams?: Record<string, number | boolean>;
  readonly normalizeParams?: (
    params: Partial<Record<string, number | boolean>> | undefined,
    defaults: Record<string, number | boolean>,
  ) => Record<string, number | boolean>;
  readonly applyParams?: (
    state: unknown,
    params: Record<string, number | boolean>,
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

/**
 * Parameters for the Blackman interpolation strategy.
 *
 * @property zeroCrossings Kernel half-width in zero-crossings (2–8, default: 4)
 * @property normalize If true, output is normalized so weights sum to 1 (default: false)
 * @property alpha Blackman window alpha coefficient (default: 0.42)
 * @property beta Blackman window beta coefficient (default: 0.5)
 * @property gamma Blackman window gamma coefficient (default: 0.08)
 */
export interface BlackmanStrategyParams extends Record<
  string,
  number | boolean
> {
  zeroCrossings: number;
  normalize: boolean;
  alpha: number;
  beta: number;
  gamma: number;
}

const BLACKMAN_DEFAULT_PARAMS: BlackmanStrategyParams = {
  zeroCrossings: 4,
  normalize: false,
  alpha: 0.42,
  beta: 0.5,
  gamma: 0.08,
};

function normalizeBlackmanParams(
  params: Partial<Record<string, number | boolean>> | undefined,
  defaults: Record<string, number | boolean>,
): Record<string, number | boolean> {
  const merged = {
    ...defaults,
    ...(params ?? {}),
  };
  const zeroCrossings = Math.max(
    2,
    Math.min(
      8,
      Math.round(
        Number(merged['zeroCrossings'] ?? defaults['zeroCrossings'] ?? 4),
      ),
    ),
  );
  const normalize = Boolean(merged['normalize']);
  const alpha = Number(merged['alpha'] ?? 0.42);
  const beta = Number(merged['beta'] ?? 0.5);
  const gamma = Number(merged['gamma'] ?? 0.08);
  return { zeroCrossings, normalize, alpha, beta, gamma };
}

function applyBlackmanParams(
  state: unknown,
  params: Record<string, number | boolean>,
): void {
  if (typeof state !== 'object' || state === null) {
    return;
  }
  const record = state as BlackmanKernelState;
  record.params = {
    zeroCrossings: Math.max(
      2,
      Math.round(Number(params['zeroCrossings'] ?? 4)),
    ),
    normalize: Boolean(params['normalize']),
    alpha: Number(params['alpha'] ?? 0.42),
    beta: Number(params['beta'] ?? 0.5),
    gamma: Number(params['gamma'] ?? 0.08),
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

function blackmanWindow(
  distance: number,
  radius: number,
  alpha: number,
  beta: number,
  gamma: number,
): number {
  const absDistance = Math.abs(distance);
  if (absDistance >= radius) {
    return 0;
  }
  const ratio = absDistance / radius;
  return (
    alpha +
    beta * Math.cos(Math.PI * ratio) +
    gamma * Math.cos(2 * Math.PI * ratio)
  );
}

function blackmanWeight(
  distance: number,
  radius: number,
  alpha: number,
  beta: number,
  gamma: number,
): number {
  return (
    normalizedSinc(distance) *
    blackmanWindow(distance, radius, alpha, beta, gamma)
  );
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
  const radius = kernelState.params.zeroCrossings;
  const normalize = Boolean(kernelState.params.normalize);
  const alpha =
    typeof kernelState.params.alpha === 'number'
      ? kernelState.params.alpha
      : 0.42;
  const beta =
    typeof kernelState.params.beta === 'number' ? kernelState.params.beta : 0.5;
  const gamma =
    typeof kernelState.params.gamma === 'number'
      ? kernelState.params.gamma
      : 0.08;
  const center = Math.floor(position);
  const start = center - (radius - 1);
  const end = center + radius;

  let numerator = 0;
  let denominator = 0;

  for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {
    const distance = position - sampleIndex;
    const weight = blackmanWeight(distance, radius, alpha, beta, gamma);
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

  return normalize ? numerator / denominator : numerator / (denominator || 1);
};

blackmanKernel.createState = () => ({
  prevSampleL: 0,
  prevSampleR: 0,
  params: { ...BLACKMAN_DEFAULT_PARAMS },
});

export const blackmanStrategy: InterpolationStrategyRegistration = {
  id: 'blackman',
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
