import { lanczosStrategy } from '@cxing/interpolation-strategy-lanczos';

/** Built-in interpolation strategy ids understood by the core pipeline. */
export type BuiltInInterpolationStrategy = 'linear' | 'lanczos8';

/**
 * Kernel contract for interpolation plugins.
 *
 * @remarks
 * Kernels receive interleaved stereo input and may read from `state` for
 * continuity across processing blocks.
 */
export interface InterpolationKernel {
  (
    src: Float32Array,
    srcOffset: number,
    numFrames: number,
    position: number,
    channel: 0 | 1,
    state: unknown,
  ): number;
  /** Optional factory for per-instance mutable kernel state. */
  createState?: () => unknown;
}

export type RateTransposerInterpolationStrategyId = string;

export interface RateTransposerInterpolationStrategyDescriptor {
  readonly id: RateTransposerInterpolationStrategyId;
}

export type RateTransposerInterpolationStrategyOption =
  | RateTransposerInterpolationStrategyId
  | RateTransposerInterpolationStrategyDescriptor;

export interface InterpolationStrategyRegistration {
  /** Unique strategy id used by `SoundTouch` and `RateTransposer` options. */
  readonly id: RateTransposerInterpolationStrategyId;
  /** Base strategy id used when no custom kernel is provided. */
  readonly baseStrategy?: BuiltInInterpolationStrategy;
  /** Optional plugin kernel implementation. */
  readonly kernel?: InterpolationKernel;
}

interface RegisteredInterpolationStrategy {
  readonly id: RateTransposerInterpolationStrategyId;
  readonly baseStrategy: BuiltInInterpolationStrategy;
  readonly builtIn: boolean;
  readonly kernel?: InterpolationKernel;
}

const strategyRegistry = new Map<
  RateTransposerInterpolationStrategyId,
  RegisteredInterpolationStrategy
>();

let activeStrategyId: RateTransposerInterpolationStrategyId = 'lanczos8';

function readStrategyId(
  strategy?: RateTransposerInterpolationStrategyOption,
): RateTransposerInterpolationStrategyId {
  if (typeof strategy === 'string') {
    return strategy;
  }

  if (strategy !== undefined) {
    return strategy.id;
  }

  return activeStrategyId;
}

function requireRegisteredStrategy(
  strategyId: RateTransposerInterpolationStrategyId,
): RegisteredInterpolationStrategy {
  const registered = strategyRegistry.get(strategyId);
  if (registered !== undefined) {
    return registered;
  }

  throw new Error(
    `Unknown interpolation strategy id \"${strategyId}\". Register it before use.`,
  );
}

export function registerInterpolationStrategy(
  registration: InterpolationStrategyRegistration,
): void {
  const baseStrategy = registration.baseStrategy ?? 'lanczos8';
  strategyRegistry.set(registration.id, {
    id: registration.id,
    baseStrategy,
    builtIn: false,
    kernel: registration.kernel,
  });
  activeStrategyId = registration.id;
}

function registerBuiltInInterpolationStrategy(
  registration: InterpolationStrategyRegistration,
): void {
  const baseStrategy = registration.baseStrategy ?? 'lanczos8';
  strategyRegistry.set(registration.id, {
    id: registration.id,
    baseStrategy,
    builtIn: true,
    kernel: registration.kernel,
  });
}

export function unregisterInterpolationStrategy(
  strategyId: RateTransposerInterpolationStrategyId,
): boolean {
  const existing = strategyRegistry.get(strategyId);
  if (existing === undefined || existing.builtIn) {
    return false;
  }

  const deleted = strategyRegistry.delete(strategyId);
  if (deleted && activeStrategyId === strategyId) {
    activeStrategyId = 'lanczos8';
  }

  return deleted;
}

/** Returns true when a strategy id is currently registered. */
export function hasInterpolationStrategy(
  strategyId: RateTransposerInterpolationStrategyId,
): boolean {
  return strategyRegistry.has(strategyId);
}

/** Returns all registered strategy ids sorted lexicographically. */
export function listInterpolationStrategies(): readonly RateTransposerInterpolationStrategyId[] {
  return Array.from(strategyRegistry.keys()).sort();
}

/** Returns the process-wide active strategy id used as implicit default. */
export function getActiveInterpolationStrategyId(): RateTransposerInterpolationStrategyId {
  return activeStrategyId;
}

/** Sets the process-wide active strategy id. */
export function setActiveInterpolationStrategy(
  strategy: RateTransposerInterpolationStrategyOption,
): void {
  const strategyId = readStrategyId(strategy);
  requireRegisteredStrategy(strategyId);
  activeStrategyId = strategyId;
}

/**
 * Resolves a user-provided option to a validated strategy id.
 *
 * @throws Error when the strategy id is unknown.
 */
export function normalizeInterpolationStrategyId(
  strategy?: RateTransposerInterpolationStrategyOption,
): RateTransposerInterpolationStrategyId {
  const strategyId = readStrategyId(strategy);
  requireRegisteredStrategy(strategyId);
  return strategyId;
}

/**
 * Resolves a strategy to either a built-in base id or a plugin kernel.
 *
 * @throws Error when the strategy id is unknown.
 */
export function resolveInterpolationStrategy(
  strategy?: RateTransposerInterpolationStrategyOption,
): BuiltInInterpolationStrategy | InterpolationKernel {
  const strategyId = readStrategyId(strategy);
  const registered = requireRegisteredStrategy(strategyId);
  if ('kernel' in registered && registered.kernel) {
    return registered.kernel;
  }
  return registered.baseStrategy;
}

registerBuiltInInterpolationStrategy({
  ...lanczosStrategy,
  baseStrategy: 'lanczos8',
});
