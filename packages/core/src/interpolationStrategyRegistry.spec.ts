import { describe, expect, it } from 'vitest';
import {
  getActiveInterpolationStrategyId,
  hasInterpolationStrategy,
  listInterpolationStrategies,
  normalizeInterpolationStrategyId,
  registerInterpolationStrategy,
  resolveInterpolationStrategy,
  resolveInterpolationStrategyRuntime,
  setActiveInterpolationStrategy,
  unregisterInterpolationStrategy,
} from './interpolationStrategyRegistry.js';

describe('interpolationStrategyRegistry', () => {
  it('exposes only the default built-in strategy', () => {
    const ids = listInterpolationStrategies();
    expect(ids).toContain('lanczos');
    expect(ids).not.toContain('linear');
  });

  it('registers a strategy alias without changing the active strategy', () => {
    const previous = getActiveInterpolationStrategyId();

    registerInterpolationStrategy({
      id: 'plugin/test-linear',
      baseStrategy: 'linear',
    });

    expect(hasInterpolationStrategy('plugin/test-linear')).toBe(true);
    expect(getActiveInterpolationStrategyId()).toBe(previous);
    expect(resolveInterpolationStrategy('plugin/test-linear')).toBe('linear');

    expect(unregisterInterpolationStrategy('plugin/test-linear')).toBe(true);
    setActiveInterpolationStrategy(previous);
  });

  it('does not unregister built-ins', () => {
    expect(unregisterInterpolationStrategy('lanczos')).toBe(false);
  });

  it('falls back to lanczos when the active plugin is removed', () => {
    registerInterpolationStrategy({ id: 'plugin/test-default' });
    setActiveInterpolationStrategy('plugin/test-default');
    expect(getActiveInterpolationStrategyId()).toBe('plugin/test-default');

    expect(unregisterInterpolationStrategy('plugin/test-default')).toBe(true);
    expect(getActiveInterpolationStrategyId()).toBe('lanczos');
  });
  it('registers and resolves a custom plugin kernel', () => {
    let called = 0;
    // Simple kernel: returns constant value for test
    const testKernel = function (
      src,
      srcOffset,
      numFrames,
      position,
      channel,
      state,
    ) {
      called++;
      return 42;
    };
    registerInterpolationStrategy({
      id: 'plugin/test-kernel',
      kernel: testKernel,
    });
    const resolved = resolveInterpolationStrategy('plugin/test-kernel');
    expect(typeof resolved).toBe('function');
    // Simulate a call
    const result = (resolved as Function)(
      new Float32Array(2),
      0,
      1,
      0,
      0,
      undefined,
    );
    expect(result).toBe(42);
    expect(called).toBe(1);
    unregisterInterpolationStrategy('plugin/test-kernel');
  });

  it('normalizes a strategy id', () => {
    const id = normalizeInterpolationStrategyId('lanczos');
    expect(id).toBe('lanczos');
  });

  it('normalizeInterpolationStrategyId throws for unknown strategy', () => {
    expect(() =>
      normalizeInterpolationStrategyId('plugin/nonexistent' as never),
    ).toThrow();
  });

  it('resolves runtime strategy state', () => {
    const runtime = resolveInterpolationStrategyRuntime('lanczos');
    expect(runtime.id).toBe('lanczos');
    expect(typeof runtime.kernel).toBe('function');
  });

  it('resolves runtime strategy with explicit params', () => {
    registerInterpolationStrategy({
      id: 'plugin/test-params',
      kernel: () => 0,
      defaultParams: { alpha: 0.5 },
    });
    const runtime = resolveInterpolationStrategyRuntime({
      id: 'plugin/test-params',
      params: { alpha: 0.8 },
    });
    expect(runtime.params['alpha']).toBe(0.8);
    unregisterInterpolationStrategy('plugin/test-params');
  });

  it('resolves runtime strategy for alias that delegates to kernel', () => {
    const kernel = () => 0;
    registerInterpolationStrategy({ id: 'plugin/base-kernel', kernel });
    registerInterpolationStrategy({
      id: 'plugin/alias',
      baseStrategy: 'plugin/base-kernel',
    });
    const runtime = resolveInterpolationStrategyRuntime('plugin/alias');
    expect(runtime.kernel).toBe(kernel);
    unregisterInterpolationStrategy('plugin/alias');
    unregisterInterpolationStrategy('plugin/base-kernel');
  });

  it('detects resolution cycles', () => {
    registerInterpolationStrategy({
      id: 'plugin/cycleA',
      baseStrategy: 'plugin/cycleB',
    });
    registerInterpolationStrategy({
      id: 'plugin/cycleB',
      baseStrategy: 'plugin/cycleA',
    });
    expect(() => resolveInterpolationStrategyRuntime('plugin/cycleA')).toThrow(
      'cycle',
    );
    unregisterInterpolationStrategy('plugin/cycleA');
    unregisterInterpolationStrategy('plugin/cycleB');
  });

  it('does not unregister a strategy that is not registered', () => {
    expect(unregisterInterpolationStrategy('plugin/ghost' as never)).toBe(
      false,
    );
  });
});
