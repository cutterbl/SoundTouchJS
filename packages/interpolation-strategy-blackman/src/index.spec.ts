import { describe, expect, it, vi } from 'vitest';

import {
  blackmanKernel,
  blackmanStrategy,
  registerBlackmanStrategy,
} from './index.js';

describe('blackman interpolation strategy', () => {
  describe('blackmanKernel.createState', () => {
    it('returns default state values', () => {
      const state = blackmanKernel.createState?.() as {
        prevSampleL: number;
        prevSampleR: number;
        params: { zeroCrossings: number };
      };

      expect(state.prevSampleL).toBe(0);
      expect(state.prevSampleR).toBe(0);
      expect(state.params.zeroCrossings).toBe(4);
    });
  });

  describe('blackmanKernel', () => {
    it('returns finite interpolated values for in-range positions', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 4 },
      };

      const value = blackmanKernel(src, 0, 4, 1.5, 0, state);
      expect(Number.isFinite(value)).toBe(true);
    });

    it('uses previous sample values before frame zero', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 9,
        prevSampleR: 11,
        params: { zeroCrossings: 4 },
      };

      const leftValue = blackmanKernel(src, 0, 2, -0.25, 0, state);
      const rightValue = blackmanKernel(src, 0, 2, -0.25, 1, state);

      expect(Number.isFinite(leftValue)).toBe(true);
      expect(Number.isFinite(rightValue)).toBe(true);
      expect(leftValue).toBeGreaterThan(0);
      expect(rightValue).toBeGreaterThan(0);
    });

    it('uses edge sample values beyond available frames', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 4 },
      };

      const value = blackmanKernel(src, 0, 2, 20, 1, state);
      expect(value).toBe(40);
    });
  });

  describe('blackmanStrategy', () => {

    it('normalizes zeroCrossings, normalize, alpha, beta, gamma and applies params', () => {
      const normalizedLow = blackmanStrategy.normalizeParams?.(
        { zeroCrossings: 1, normalize: 0, alpha: 0.1, beta: 0.2, gamma: 0.3 },
        blackmanStrategy.defaultParams ?? {},
      );
      const normalizedHigh = blackmanStrategy.normalizeParams?.(
        { zeroCrossings: 99, normalize: 1, alpha: 0.5, beta: 0.6, gamma: 0.7 },
        blackmanStrategy.defaultParams ?? {},
      );
      const normalizedUndefined = blackmanStrategy.normalizeParams?.(
        undefined,
        {},
      );

      expect(normalizedLow?.zeroCrossings).toBe(2);
      expect(normalizedLow?.normalize).toBe(false);
      expect(normalizedLow?.alpha).toBeCloseTo(0.1, 6);
      expect(normalizedLow?.beta).toBeCloseTo(0.2, 6);
      expect(normalizedLow?.gamma).toBeCloseTo(0.3, 6);
      expect(normalizedHigh?.zeroCrossings).toBe(8);
      expect(normalizedHigh?.normalize).toBe(true);
      expect(normalizedHigh?.alpha).toBeCloseTo(0.5, 6);
      expect(normalizedHigh?.beta).toBeCloseTo(0.6, 6);
      expect(normalizedHigh?.gamma).toBeCloseTo(0.7, 6);
      expect(normalizedUndefined?.zeroCrossings).toBe(4);

      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 4, normalize: false, alpha: 0.42, beta: 0.5, gamma: 0.08 },
      };
      blackmanStrategy.applyParams?.(state, { zeroCrossings: 6, normalize: 1, alpha: 0.5, beta: 0.6, gamma: 0.7 });
      expect(state.params.zeroCrossings).toBe(6);
      expect(state.params.normalize).toBe(true);
      expect(state.params.alpha).toBeCloseTo(0.5, 6);
      expect(state.params.beta).toBeCloseTo(0.6, 6);
      expect(state.params.gamma).toBeCloseTo(0.7, 6);

      expect(() =>
        blackmanStrategy.applyParams?.(null, { zeroCrossings: 6 }),
      ).not.toThrow();
    });

    it('produces correct output for normalize and window coefficients', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      // normalize = false, default coefficients
      let state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, normalize: false, alpha: 0.42, beta: 0.5, gamma: 0.08 } };
      const valDefault = blackmanKernel(src, 0, 4, 1.5, 0, state);
      // normalize = true
      state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, normalize: true, alpha: 0.42, beta: 0.5, gamma: 0.08 } };
      const valNorm = blackmanKernel(src, 0, 4, 1.5, 0, state);
      // custom coefficients
      state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, normalize: false, alpha: 0.5, beta: 0.6, gamma: 0.7 } };
      const valCustom = blackmanKernel(src, 0, 4, 1.5, 0, state);
      // Should be finite and normalization should not change value much
      expect(valNorm).toBeCloseTo(valDefault, 6);
      expect(Number.isFinite(valCustom)).toBe(true);
    });

    it('registers the strategy through helper', () => {
      const registerInterpolationStrategy = vi.fn();
      registerBlackmanStrategy({ registerInterpolationStrategy });
      expect(registerInterpolationStrategy).toHaveBeenCalledWith(
        blackmanStrategy,
      );
    });
  });
});
