import { lanczosStrategy } from '@soundtouchjs/interpolation-strategy-lanczos';

/** Built-in interpolation strategy ids understood by the core pipeline. */
export type BuiltInInterpolationStrategy = 'linear' | 'lanczos';

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

export type InterpolationStrategyParams = Record<string, number | boolean>;

export type RateTransposerInterpolationStrategyId = string;

export interface RateTransposerInterpolationStrategyDescriptor {
  readonly id: RateTransposerInterpolationStrategyId;
  readonly params?: Partial<InterpolationStrategyParams>;
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
  /** Default params merged with runtime overrides. */
  readonly defaultParams?: InterpolationStrategyParams;
  /** Optional params normalizer/validator. */
  readonly normalizeParams?: (
    params: Partial<InterpolationStrategyParams> | undefined,
    defaults: InterpolationStrategyParams,
  ) => InterpolationStrategyParams;
  /** Optional hook used to apply params to kernel state. */
  readonly applyParams?: (
    state: unknown,
    params: InterpolationStrategyParams,
  ) => void;
}

export interface ResolvedInterpolationStrategyRuntime {
  readonly id: RateTransposerInterpolationStrategyId;
  readonly kernel: InterpolationKernel;
  readonly params: InterpolationStrategyParams;
  readonly applyParams?: (
    state: unknown,
    params: InterpolationStrategyParams,
  ) => void;
}

interface RegisteredInterpolationStrategy {
  readonly id: RateTransposerInterpolationStrategyId;
  readonly baseStrategy: BuiltInInterpolationStrategy;
  readonly builtIn: boolean;
  readonly kernel?: InterpolationKernel;
  readonly defaultParams: InterpolationStrategyParams;
  readonly normalizeParams?: (
    params: Partial<InterpolationStrategyParams> | undefined,
    defaults: InterpolationStrategyParams,
  ) => InterpolationStrategyParams;
  readonly applyParams?: (
    state: unknown,
    params: InterpolationStrategyParams,
  ) => void;
}

const strategyRegistry = new Map<
  RateTransposerInterpolationStrategyId,
  RegisteredInterpolationStrategy
>();

let activeStrategyId: RateTransposerInterpolationStrategyId = 'lanczos';

function readStrategySelection(
  strategy?: RateTransposerInterpolationStrategyOption,
): RateTransposerInterpolationStrategyDescriptor {
  if (typeof strategy === 'string') {
    return { id: strategy };
  }

  if (strategy !== undefined) {
    return strategy;
  }

  return { id: activeStrategyId };
}

function readStrategyId(
  strategy?: RateTransposerInterpolationStrategyOption,
): RateTransposerInterpolationStrategyId {
  return readStrategySelection(strategy).id;
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
  const baseStrategy = registration.baseStrategy ?? 'lanczos';
  strategyRegistry.set(registration.id, {
    id: registration.id,
    baseStrategy,
    builtIn: false,
    kernel: registration.kernel,
    defaultParams: { ...(registration.defaultParams ?? {}) },
    normalizeParams: registration.normalizeParams,
    applyParams: registration.applyParams,
  });
}

function registerBuiltInInterpolationStrategy(
  registration: InterpolationStrategyRegistration,
): void {
  const baseStrategy = registration.baseStrategy ?? 'lanczos';
  strategyRegistry.set(registration.id, {
    id: registration.id,
    baseStrategy,
    builtIn: true,
    kernel: registration.kernel,
    defaultParams: { ...(registration.defaultParams ?? {}) },
    normalizeParams: registration.normalizeParams,
    applyParams: registration.applyParams,
  });
}

function resolveKernelRegistration(
  registration: RegisteredInterpolationStrategy,
  visited: Set<string> = new Set(),
): RegisteredInterpolationStrategy {
  if (registration.kernel !== undefined) {
    return registration;
  }

  if (visited.has(registration.id)) {
    throw new Error(
      `Interpolation strategy resolution cycle detected at "${registration.id}".`,
    );
  }

  visited.add(registration.id);
  const next = requireRegisteredStrategy(registration.baseStrategy);
  return resolveKernelRegistration(next, visited);
}

function normalizeParams(
  registration: RegisteredInterpolationStrategy,
  params: Partial<InterpolationStrategyParams> | undefined,
): InterpolationStrategyParams {
  const defaults = registration.defaultParams;
  if (registration.normalizeParams !== undefined) {
    return registration.normalizeParams(params, defaults);
  }

  const normalized: InterpolationStrategyParams = { ...defaults };
  if (params !== undefined) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        normalized[key] = value;
      }
    }
  }

  return normalized;
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
    activeStrategyId = 'lanczos';
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

/**
 * Resolves runtime strategy state (kernel + normalized params + applier hook).
 */
export function resolveInterpolationStrategyRuntime(
  strategy?: RateTransposerInterpolationStrategyOption,
): ResolvedInterpolationStrategyRuntime {
  const selection = readStrategySelection(strategy);
  const registered = requireRegisteredStrategy(selection.id);
  const kernelRegistration = resolveKernelRegistration(registered);
  const kernel = kernelRegistration.kernel;
  if (kernel === undefined) {
    throw new Error(
      `Interpolation strategy "${selection.id}" did not resolve to a kernel.`,
    );
  }

  const params = normalizeParams(registered, selection.params);

  return {
    id: registered.id,
    kernel,
    params,
    applyParams: registered.applyParams ?? kernelRegistration.applyParams,
  };
}

registerBuiltInInterpolationStrategy({
  ...lanczosStrategy,
  baseStrategy: 'lanczos',
});
