import { describe, expect, it } from 'vitest';
import * as Core from './index.js';

describe('core public exports', () => {
  it('exposes the expected runtime symbols', () => {
    const runtimeKeys = Object.keys(Core).sort();

    const expectedRuntimeKeys = [
      'AbstractSamplePipe',
      'CircularSampleBuffer',
      'FifoSampleBuffer',
      'RateTransposer',
      'SoundTouch',
      'Stretch',
      'getActiveInterpolationStrategyId',
      'hasInterpolationStrategy',
      'listInterpolationStrategies',
      'normalizeInterpolationStrategyId',
      'registerInterpolationStrategy',
      'resolveInterpolationStrategy',
      'resolveInterpolationStrategyRuntime',
      'setActiveInterpolationStrategy',
      'unregisterInterpolationStrategy',
    ].sort();

    expect(runtimeKeys).toEqual(expectedRuntimeKeys);
  });
});
