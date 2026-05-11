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

interface HannKernelState {
  prevSampleL: number;
  prevSampleR: number;
  params: HannStrategyParams;
}


/**
 * Parameters for the Hann interpolation strategy.
 *
 * @property zeroCrossings Kernel half-width in zero-crossings (2–8, default: 4)
 * @property normalize If true, output is normalized so weights sum to 1 (default: false)
 * @property windowPower Exponent to raise the Hann window (default: 1)
 */
export interface HannStrategyParams extends Record<string, number | boolean> {
  zeroCrossings: number;
  normalize?: boolean;
  windowPower?: number;
}

const HANN_DEFAULT_PARAMS: HannStrategyParams = {
  zeroCrossings: 4,
  normalize: false,
  windowPower: 1,
};

function normalizeHannParams(
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
  const windowPower = Math.max(0.1, Number(merged['windowPower'] ?? 1));
  return { zeroCrossings, normalize, windowPower };
}

function applyHannParams(state: unknown, params: Record<string, number | boolean>): void {
  if (typeof state !== 'object' || state === null) {
    return;
  }
  const record = state as HannKernelState;
  record.params = {
    zeroCrossings: Math.max(2, Math.round(Number(params['zeroCrossings'] ?? 4))),
    normalize: Boolean(params['normalize']),
    windowPower: Math.max(0.1, Number(params['windowPower'] ?? 1)),
  };
}

function readFrameSample(
  src: Float32Array,
  srcOffset: number,
  numFrames: number,
  frameIndex: number,
  channel: 0 | 1,
  state: HannKernelState,
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

function hannWindow(distance: number, radius: number, windowPower: number): number {
  const absDistance = Math.abs(distance);
  if (absDistance >= radius) {
    return 0;
  }
  const base = 0.5 + 0.5 * Math.cos((Math.PI * absDistance) / radius);
  return Math.pow(base, windowPower);
}

function hannWeight(distance: number, radius: number, windowPower: number): number {
  return normalizedSinc(distance) * hannWindow(distance, radius, windowPower);
}


export const hannKernel: InterpolationKernel = (
  src,
  srcOffset,
  numFrames,
  position,
  channel,
  state,
) => {
  const kernelState = state as HannKernelState;
  const radius = kernelState.params.zeroCrossings;
  const normalize = Boolean(kernelState.params.normalize);
  const windowPower = typeof kernelState.params.windowPower === 'number' ? kernelState.params.windowPower : 1;
  const center = Math.floor(position);
  const start = center - (radius - 1);
  const end = center + radius;

  let numerator = 0;
  let denominator = 0;

  for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {
    const distance = position - sampleIndex;
    const weight = hannWeight(distance, radius, windowPower);
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

hannKernel.createState = () => ({
  prevSampleL: 0,
  prevSampleR: 0,
  params: { ...HANN_DEFAULT_PARAMS },
});

export const hannStrategy: InterpolationStrategyRegistration = {
  id: 'hann',
  baseStrategy: 'linear',
  kernel: hannKernel,
  defaultParams: HANN_DEFAULT_PARAMS,
  normalizeParams: normalizeHannParams,
  applyParams: applyHannParams,
};

export function registerHannStrategy(
  registry: InterpolationStrategyRegistrar,
): void {
  registry.registerInterpolationStrategy(hannStrategy);
}
