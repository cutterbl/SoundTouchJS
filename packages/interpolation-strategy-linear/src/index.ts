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
}

export interface InterpolationStrategyRegistrar {
  registerInterpolationStrategy: (
    registration: InterpolationStrategyRegistration,
  ) => void;
}

interface LinearKernelState {
  prevSampleL: number;
  prevSampleR: number;
}

function readFrameSample(
  src: Float32Array,
  srcOffset: number,
  numFrames: number,
  frameIndex: number,
  channel: 0 | 1,
  state: LinearKernelState,
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

linearKernel.createState = () => ({ prevSampleL: 0, prevSampleR: 0 });

/** Default linear strategy registration payload. */
export const linearStrategy: InterpolationStrategyRegistration = {
  id: 'linear',
  baseStrategy: 'linear',
  kernel: linearKernel,
};

/** Registers the linear strategy in a compatible registry. */
export function registerLinearStrategy(
  registry: InterpolationStrategyRegistrar,
): void {
  registry.registerInterpolationStrategy(linearStrategy);
}
