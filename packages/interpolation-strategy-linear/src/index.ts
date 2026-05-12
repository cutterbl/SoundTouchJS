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
  readonly defaultParams?: Record<string, number | boolean>;
  /** Optional params normalizer/validator. */
  readonly normalizeParams?: (
    params: Partial<Record<string, number | boolean>> | undefined,
    defaults: Record<string, number | boolean>,
  ) => Record<string, number | boolean>;
  /** Optional hook used to apply params to kernel state. */
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

interface LinearKernelState {
  prevSampleL: number;
  prevSampleR: number;
  params: LinearStrategyParams;
}

/**
 * Parameters for the Linear interpolation strategy.
 *
 * @property edgeHoldFrames Number of frames to hold at edges (0–32, default: 1)
 * @property blend Blend between nearest (0) and linear (1) interpolation (0–1, default: 1)
 * @property normalize If true, output is normalized so weights sum to 1 (default: false)
 * @property zeroCrossings Alias for edgeHoldFrames (optional, overrides edgeHoldFrames if set)
 */
export interface LinearStrategyParams {
  edgeHoldFrames: number;
  blend?: number;
  normalize?: boolean;
  zeroCrossings?: number;
}

// Use Record<string, number | boolean> for defaultParams to match InterpolationStrategyRegistration
const LINEAR_DEFAULT_PARAMS: Record<string, number | boolean> = {
  edgeHoldFrames: 1,
  blend: 1,
  normalize: false,
};

function normalizeLinearParams(
  params: Partial<Record<string, number | boolean>> | undefined,
  defaults: Record<string, number | boolean>,
): Record<string, number | boolean> {
  const merged = {
    ...defaults,
    ...(params ?? {}),
  };
  // zeroCrossings is an alias for edgeHoldFrames if set
  const edgeHoldFrames =
    merged['zeroCrossings'] !== undefined
      ? Math.max(0, Math.min(32, Math.round(Number(merged['zeroCrossings']))))
      : Math.max(
          0,
          Math.min(
            32,
            Math.round(
              Number(
                merged['edgeHoldFrames'] ?? defaults['edgeHoldFrames'] ?? 1,
              ),
            ),
          ),
        );
  const blend = Math.max(0, Math.min(1, Number(merged['blend'] ?? 1)));
  const normalize = Boolean(merged['normalize']);
  return { edgeHoldFrames, blend, normalize };
}

function applyLinearParams(
  state: unknown,
  params: Record<string, number | boolean>,
): void {
  if (typeof state !== 'object' || state === null) {
    return;
  }
  const record = state as LinearKernelState;
  record.params = {
    edgeHoldFrames: Math.max(
      0,
      Math.round(Number(params['edgeHoldFrames'] ?? 1)),
    ),
    blend: Math.max(0, Math.min(1, Number(params['blend'] ?? 1))),
    // Accept both boolean and number for normalize
    normalize: Boolean(params['normalize']),
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
  const blend =
    typeof kernelState.params.blend === 'number' ? kernelState.params.blend : 1;
  const normalize = Boolean(kernelState.params.normalize);
  // Nearest and linear values
  const leftVal = readFrameSample(
    src,
    srcOffset,
    numFrames,
    left,
    channel,
    kernelState,
  );
  const rightVal = readFrameSample(
    src,
    srcOffset,
    numFrames,
    right,
    channel,
    kernelState,
  );
  const linearVal = (1 - frac) * leftVal + frac * rightVal;
  const nearestVal = frac < 0.5 ? leftVal : rightVal;
  let result = blend * linearVal + (1 - blend) * nearestVal;
  if (normalize) {
    // For linear, normalization is trivial: weights sum to 1
    // But if blend < 1, normalize the weights
    const wLeft = blend * (1 - frac) + (1 - blend) * (frac < 0.5 ? 1 : 0);
    const wRight = blend * frac + (1 - blend) * (frac >= 0.5 ? 1 : 0);
    const wSum = wLeft + wRight;
    if (wSum !== 0) {
      result = (wLeft * leftVal + wRight * rightVal) / wSum;
    }
  }
  return result;
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
