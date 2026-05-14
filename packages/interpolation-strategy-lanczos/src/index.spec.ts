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
        params: { zeroCrossings: number };
      };

      expect(state.prevSampleL).toBe(0);
      expect(state.prevSampleR).toBe(0);
      expect(state.params.zeroCrossings).toBe(4);
    });
  });

  describe('lanczosKernel', () => {
    it('returns interpolated value for in-range sample positions', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 4 },
      };

      const value = lanczosKernel(src, 0, 4, 1.5, 0, state);
      expect(Number.isFinite(value)).toBe(true);
    });

    it('uses previous sample values when reading before frame zero', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 9,
        prevSampleR: 11,
        params: { zeroCrossings: 4 },
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
        params: { zeroCrossings: 4 },
      };

      const value = lanczosKernel(src, 0, 2, 20, 1, state);
      expect(value).toBe(40);
    });

    it('falls back to rounded frame read when denominator collapses', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 0 },
      };

      const value = lanczosKernel(src, 0, 2, 0.49, 0, state);
      expect(value).toBe(10);
    });
  });

  describe('lanczosStrategy', () => {

    it('normalizes zeroCrossings and normalize and applies params to state', () => {
      const normalizedLow = lanczosStrategy.normalizeParams?.(
        { zeroCrossings: 1, normalize: 0 },
        lanczosStrategy.defaultParams ?? {},
      );
      const normalizedHigh = lanczosStrategy.normalizeParams?.(
        { zeroCrossings: 99, normalize: 1 },
        lanczosStrategy.defaultParams ?? {},
      );
      const normalizedUndefined = lanczosStrategy.normalizeParams?.(
        undefined,
        {},
      );

      expect(normalizedLow?.zeroCrossings).toBe(2);
      expect(normalizedLow?.normalize).toBe(false);
      expect(normalizedHigh?.zeroCrossings).toBe(8);
      expect(normalizedHigh?.normalize).toBe(true);
      expect(normalizedUndefined?.zeroCrossings).toBe(4);

      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 4, normalize: false },
      };
      lanczosStrategy.applyParams?.(state, { zeroCrossings: 6, normalize: 1 });
      expect(state.params.zeroCrossings).toBe(6);
      expect(state.params.normalize).toBe(true);
      lanczosStrategy.applyParams?.(state, {});
      expect(state.params.zeroCrossings).toBe(4);

      expect(() =>
        lanczosStrategy.applyParams?.(null, { zeroCrossings: 6 }),
      ).not.toThrow();
    });

    it('produces correct output for normalize param', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      // normalize = false (default)
      let state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, normalize: false } };
      const valDefault = lanczosKernel(src, 0, 4, 1.5, 0, state);
      // normalize = true
      state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, normalize: true } };
      const valNorm = lanczosKernel(src, 0, 4, 1.5, 0, state);
      // Should be very close, but normalization guarantees weights sum to 1
      expect(valNorm).toBeCloseTo(valDefault, 6);
    });

    it('registers the strategy through helper', () => {
      const registerInterpolationStrategy = vi.fn();
      registerLanczosStrategy({ registerInterpolationStrategy });
      expect(registerInterpolationStrategy).toHaveBeenCalledWith(
        lanczosStrategy,
      );
    });
  });
});
