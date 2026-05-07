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

interface LanczosKernelState {
  prevSampleL: number;
  prevSampleR: number;
}

const LANCZOS_RADIUS = 4;

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
  const center = Math.floor(position);
  const start = center - (LANCZOS_RADIUS - 1);
  const end = center + LANCZOS_RADIUS;

  let numerator = 0;
  let denominator = 0;

  for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {
    const distance = position - sampleIndex;
    const weight = lanczosWeight(distance, LANCZOS_RADIUS);
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

lanczosKernel.createState = () => ({ prevSampleL: 0, prevSampleR: 0 });

/** Default Lanczos strategy registration payload. */
export const lanczosStrategy: InterpolationStrategyRegistration = {
  id: 'lanczos8',
  baseStrategy: 'linear',
  kernel: lanczosKernel,
};

/** Registers the Lanczos strategy in a compatible registry. */
export function registerLanczosStrategy(
  registry: InterpolationStrategyRegistrar,
): void {
  registry.registerInterpolationStrategy(lanczosStrategy);
}
