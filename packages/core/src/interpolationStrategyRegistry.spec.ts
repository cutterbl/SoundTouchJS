import { describe, expect, it } from 'vitest';
import {
  getActiveInterpolationStrategyId,
  hasInterpolationStrategy,
  listInterpolationStrategies,
  registerInterpolationStrategy,
  resolveInterpolationStrategy,
  setActiveInterpolationStrategy,
  unregisterInterpolationStrategy,
} from './interpolationStrategyRegistry.js';

describe('interpolationStrategyRegistry', () => {
  it('exposes only the default built-in strategy', () => {
    const ids = listInterpolationStrategies();
    expect(ids).toContain('lanczos8');
    expect(ids).not.toContain('linear');
  });

  it('registers a strategy alias and sets it active immediately', () => {
    const previous = getActiveInterpolationStrategyId();

    registerInterpolationStrategy({
      id: 'plugin/test-linear',
      baseStrategy: 'linear',
    });

    expect(hasInterpolationStrategy('plugin/test-linear')).toBe(true);
    expect(getActiveInterpolationStrategyId()).toBe('plugin/test-linear');
    expect(resolveInterpolationStrategy('plugin/test-linear')).toBe('linear');

    expect(unregisterInterpolationStrategy('plugin/test-linear')).toBe(true);
    setActiveInterpolationStrategy(previous);
  });

  it('does not unregister built-ins', () => {
    expect(unregisterInterpolationStrategy('lanczos8')).toBe(false);
  });

  it('falls back to lanczos8 when active plugin is removed', () => {
    registerInterpolationStrategy({ id: 'plugin/test-default' });
    expect(getActiveInterpolationStrategyId()).toBe('plugin/test-default');

    expect(unregisterInterpolationStrategy('plugin/test-default')).toBe(true);
    expect(getActiveInterpolationStrategyId()).toBe('lanczos8');
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
});
