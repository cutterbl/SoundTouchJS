export type BuiltInInterpolationStrategy = 'linear' | 'lanczos8';

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

interface LinearKernelState {
  prevSampleL: number;
  prevSampleR: number;
  params: LinearStrategyParams;
}

export interface LinearStrategyParams {
  edgeHoldFrames: number;
}

const LINEAR_DEFAULT_PARAMS: LinearStrategyParams = {
  edgeHoldFrames: 1,
};

function normalizeLinearParams(
  params: Partial<Record<string, number>> | undefined,
  defaults: Record<string, number>,
): Record<string, number> {
  const merged = {
    ...defaults,
    ...(params ?? {}),
  };
  const edgeHoldFrames = Math.max(
    0,
    Math.min(
      32,
      Math.round(merged['edgeHoldFrames'] ?? defaults['edgeHoldFrames'] ?? 1),
    ),
  );

  return { edgeHoldFrames };
}

function applyLinearParams(
  state: unknown,
  params: Record<string, number>,
): void {
  if (typeof state !== 'object' || state === null) {
    return;
  }
  const record = state as LinearKernelState;
  record.params = {
    edgeHoldFrames: Math.max(0, Math.round(params['edgeHoldFrames'] ?? 1)),
  };
}

function readFrameSample(
  src: Float32Array,
  srcOffset: number,
  numFrames: number,
  frameIndex: number,
  channel: 0 | 1,
  state: LinearKernelState,
): number {
  const edgeHoldFrames = state.params.edgeHoldFrames;
  if (frameIndex < 0) {
    if (-frameIndex > edgeHoldFrames) {
      return 0;
    }
    return channel === 0 ? state.prevSampleL : state.prevSampleR;
  }

  if (frameIndex >= numFrames) {
    if (frameIndex - numFrames >= edgeHoldFrames) {
      return 0;
    }
    const edgeIndex = srcOffset + 2 * (numFrames - 1) + channel;
    return src[edgeIndex];
  }

  return src[srcOffset + 2 * frameIndex + channel];
}

export const linearKernel: InterpolationKernel = (
  src,
  srcOffset,
  numFrames,
  position,
  channel,
  state,
) => {
  const kernelState = state as LinearKernelState;
  const left = Math.floor(position);
  const right = left + 1;
  const frac = position - left;
  return (
    (1 - frac) *
      readFrameSample(src, srcOffset, numFrames, left, channel, kernelState) +
    frac *
      readFrameSample(src, srcOffset, numFrames, right, channel, kernelState)
  );
};

linearKernel.createState = () => ({
  prevSampleL: 0,
  prevSampleR: 0,
  params: { ...LINEAR_DEFAULT_PARAMS },
});

/** Default linear strategy registration payload. */
export const linearStrategy: InterpolationStrategyRegistration = {
  id: 'linear',
  baseStrategy: 'linear',
  kernel: linearKernel,
  defaultParams: LINEAR_DEFAULT_PARAMS,
  normalizeParams: normalizeLinearParams,
  applyParams: applyLinearParams,
};

/** Registers the linear strategy in a compatible registry. */
export function registerLinearStrategy(
  registry: InterpolationStrategyRegistrar,
): void {
  registry.registerInterpolationStrategy(linearStrategy);
}
