import { describe, expect, it, vi } from 'vitest';

import {
  lanczosKernel,
  lanczosStrategy,
  registerLanczosStrategy,
} from './index.js';

describe('lanczos interpolation strategy', () => {
  describe('lanczosKernel.createState', () => {
    it('returns default state values', () => {
      const state = lanczosKernel.createState?.() as {
        prevSampleL: number;
        prevSampleR: number;
        params: { radius: number };
      };

      expect(state.prevSampleL).toBe(0);
      expect(state.prevSampleR).toBe(0);
      expect(state.params.radius).toBe(4);
    });
  });

  describe('lanczosKernel', () => {
    it('returns interpolated value for in-range sample positions', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { radius: 4 },
      };

      const value = lanczosKernel(src, 0, 4, 1.5, 0, state);
      expect(Number.isFinite(value)).toBe(true);
    });

    it('uses previous sample values when reading before frame zero', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 9,
        prevSampleR: 11,
        params: { radius: 4 },
      };

      const value = lanczosKernel(src, 0, 2, -0.4, 0, state);
      const rightChannelValue = lanczosKernel(src, 0, 2, -0.4, 1, state);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(3);
      expect(Number.isFinite(rightChannelValue)).toBe(true);
      expect(rightChannelValue).toBeGreaterThan(3);
    });

    it('uses edge sample values when reading beyond available frames', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { radius: 4 },
      };

      const value = lanczosKernel(src, 0, 2, 20, 1, state);
      expect(value).toBe(40);
    });

    it('falls back to rounded frame read when denominator collapses', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { radius: 0 },
      };

      const value = lanczosKernel(src, 0, 2, 0.49, 0, state);
      expect(value).toBe(10);
    });
  });

  describe('lanczosStrategy', () => {
    it('normalizes radius and applies params to state', () => {
      const normalizedLow = lanczosStrategy.normalizeParams?.(
        { radius: 1 },
        lanczosStrategy.defaultParams ?? {},
      );
      const normalizedHigh = lanczosStrategy.normalizeParams?.(
        { radius: 99 },
        lanczosStrategy.defaultParams ?? {},
      );
      const normalizedUndefined = lanczosStrategy.normalizeParams?.(
        undefined,
        {},
      );

      expect(normalizedLow?.radius).toBe(2);
      expect(normalizedHigh?.radius).toBe(8);
      expect(normalizedUndefined?.radius).toBe(4);

      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { radius: 4 },
      };
      lanczosStrategy.applyParams?.(state, { radius: 6 });
      expect(state.params.radius).toBe(6);
      lanczosStrategy.applyParams?.(state, {});
      expect(state.params.radius).toBe(4);

      expect(() => lanczosStrategy.applyParams?.(null, { radius: 6 })).not.toThrow();
    });

    it('registers the strategy through helper', () => {
      const registerInterpolationStrategy = vi.fn();
      registerLanczosStrategy({ registerInterpolationStrategy });
      expect(registerInterpolationStrategy).toHaveBeenCalledWith(lanczosStrategy);
    });
  });
});
