export type BuiltInInterpolationStrategy = 'linear' | 'lanczos';

/** Kernel contract compatible with the core interpolation registry. */
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
  /** Unique strategy id used by consumers. */
  readonly id: string;
  /** Base strategy used when kernel chaining is desired. */
  readonly baseStrategy?: BuiltInInterpolationStrategy;
  /** Kernel implementation for interpolation. */
  readonly kernel?: InterpolationKernel;
  /** Default params merged with runtime overrides. */
  readonly defaultParams?: Record<string, number>;
  /** Optional params normalizer/validator. */
  readonly normalizeParams?: (
    params: Partial<Record<string, number>> | undefined,
    defaults: Record<string, number>,
  ) => Record<string, number>;
  /** Optional hook used to apply params to kernel state. */
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

interface LanczosKernelState {
  prevSampleL: number;
  prevSampleR: number;
  params: LanczosStrategyParams;
}


/**
 * Parameters for the Lanczos interpolation strategy.
 *
 * @property zeroCrossings Kernel half-width in zero-crossings (2–8, default: 4)
 * @property normalize If true, output is normalized so weights sum to 1 (default: false)
 */
export interface LanczosStrategyParams extends Record<string, number | boolean> {
  zeroCrossings: number;
  normalize?: boolean;
}

const LANCZOS_DEFAULT_PARAMS: LanczosStrategyParams = {
  zeroCrossings: 4,
  normalize: false,
};

function normalizeLanczosParams(
  params: Partial<Record<string, number | boolean>> | undefined,
  defaults: Record<string, number | boolean>,
): Record<string, number | boolean> {
  const merged = {
    ...defaults,
    ...(params ?? {}),
  };
  const zeroCrossings = Math.max(
    2,
    Math.min(8, Math.round(Number(merged['zeroCrossings'] ?? defaults['zeroCrossings'] ?? 4))),
  );
  const normalize = Boolean(merged['normalize']);
  return { zeroCrossings, normalize };
}

function applyLanczosParams(
  state: unknown,
  params: Record<string, number | boolean>,
): void {
  if (typeof state !== 'object' || state === null) {
    return;
  }
  const record = state as LanczosKernelState;
  record.params = {
    zeroCrossings: Math.max(2, Math.round(Number(params['zeroCrossings'] ?? 4))),
    normalize: Boolean(params['normalize']),
  };
}

function readFrameSample(
  src: Float32Array,
  srcOffset: number,
  numFrames: number,
  frameIndex: number,
  channel: 0 | 1,
  state: LanczosKernelState,
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

function lanczosWeight(distance: number, radius: number): number {
  const absDistance = Math.abs(distance);
  if (absDistance >= radius) {
    return 0;
  }
  return normalizedSinc(distance) * normalizedSinc(distance / radius);
}


export const lanczosKernel: InterpolationKernel = (
  src,
  srcOffset,
  numFrames,
  position,
  channel,
  state,
) => {
  const kernelState = state as LanczosKernelState;
  const radius = kernelState.params.zeroCrossings;
  const normalize = Boolean(kernelState.params.normalize);
  const center = Math.floor(position);
  const start = center - (radius - 1);
  const end = center + radius;

  let numerator = 0;
  let denominator = 0;

  for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {
    const distance = position - sampleIndex;
    const weight = lanczosWeight(distance, radius);
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

lanczosKernel.createState = () => ({
  prevSampleL: 0,
  prevSampleR: 0,
  params: { ...LANCZOS_DEFAULT_PARAMS },
});

/** Default Lanczos strategy registration payload. */
export const lanczosStrategy: InterpolationStrategyRegistration = {
  id: 'lanczos',
  baseStrategy: 'linear',
  kernel: lanczosKernel,
  defaultParams: LANCZOS_DEFAULT_PARAMS,
  normalizeParams: normalizeLanczosParams,
  applyParams: applyLanczosParams,
};

/** Registers the Lanczos strategy in a compatible registry. */
export function registerLanczosStrategy(
  registry: InterpolationStrategyRegistrar,
): void {
  registry.registerInterpolationStrategy(lanczosStrategy);
}
