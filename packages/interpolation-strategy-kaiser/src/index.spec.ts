import { describe, expect, it, vi } from 'vitest';

import { kaiserKernel, kaiserStrategy, registerKaiserStrategy } from './index.js';

describe('kaiser interpolation strategy', () => {
  describe('kaiserKernel.createState', () => {
    it('returns default state values', () => {
      const state = kaiserKernel.createState?.() as {
        prevSampleL: number;
        prevSampleR: number;
        params: { zeroCrossings: number; beta: number };
      };

      expect(state.prevSampleL).toBe(0);
      expect(state.prevSampleR).toBe(0);
      expect(state.params.zeroCrossings).toBe(4);
      expect(state.params.beta).toBeCloseTo(8.6, 6);
    });
  });

  describe('kaiserKernel', () => {
    it('returns finite interpolated values for in-range positions', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 4, beta: 8.6 },
      };

      const value = kaiserKernel(src, 0, 4, 1.5, 0, state);
      expect(Number.isFinite(value)).toBe(true);
    });

    it('uses previous sample values before frame zero', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 9,
        prevSampleR: 11,
        params: { zeroCrossings: 4, beta: 8.6 },
      };

      const leftValue = kaiserKernel(src, 0, 2, -0.25, 0, state);
      const rightValue = kaiserKernel(src, 0, 2, -0.25, 1, state);

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
        params: { zeroCrossings: 4, beta: 8.6 },
      };

      const value = kaiserKernel(src, 0, 2, 20, 1, state);
      expect(value).toBe(40);
    });

    it('falls back to rounded frame read when weights collapse', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 0, beta: 8.6 },
      };

      const value = kaiserKernel(src, 0, 2, 0.49, 0, state);
      expect(value).toBe(10);
    });
  });

  describe('kaiserStrategy', () => {

    it('normalizes zeroCrossings, beta, normalize, windowPower and applies params', () => {
      const normalizedLow = kaiserStrategy.normalizeParams?.(
        { zeroCrossings: 1, beta: -2, normalize: 0, windowPower: 0.05 },
        kaiserStrategy.defaultParams ?? {},
      );
      const normalizedHigh = kaiserStrategy.normalizeParams?.(
        { zeroCrossings: 99, beta: 50, normalize: 1, windowPower: 2 },
        kaiserStrategy.defaultParams ?? {},
      );
      const normalizedUndefined = kaiserStrategy.normalizeParams?.(
        undefined,
        {},
      );

      expect(normalizedLow?.zeroCrossings).toBe(2);
      expect(normalizedLow?.beta).toBe(0);
      expect(normalizedLow?.normalize).toBe(false);
      expect(normalizedLow?.windowPower).toBeCloseTo(0.1, 6);
      expect(normalizedHigh?.zeroCrossings).toBe(16);
      expect(normalizedHigh?.beta).toBe(20);
      expect(normalizedHigh?.normalize).toBe(true);
      expect(normalizedHigh?.windowPower).toBe(2);
      expect(normalizedUndefined?.zeroCrossings).toBe(4);
      expect(normalizedUndefined?.beta).toBeCloseTo(8.6, 6);

      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 4, beta: 8.6, normalize: false, windowPower: 1 },
      };
      kaiserStrategy.applyParams?.(state, { zeroCrossings: 6, beta: 12, normalize: 1, windowPower: 2 });
      expect(state.params.zeroCrossings).toBe(6);
      expect(state.params.beta).toBe(12);
      expect(state.params.normalize).toBe(true);
      expect(state.params.windowPower).toBe(2);

      expect(() =>
        kaiserStrategy.applyParams?.(null, { zeroCrossings: 6, beta: 12 }),
      ).not.toThrow();
    });

    it('produces correct output for normalize and windowPower params', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      // normalize = false, windowPower = 1 (default)
      let state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, beta: 8.6, normalize: false, windowPower: 1 } };
      const valDefault = kaiserKernel(src, 0, 4, 1.5, 0, state);
      // normalize = true
      state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, beta: 8.6, normalize: true, windowPower: 1 } };
      const valNorm = kaiserKernel(src, 0, 4, 1.5, 0, state);
      // windowPower = 2
      state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, beta: 8.6, normalize: false, windowPower: 2 } };
      const valPower = kaiserKernel(src, 0, 4, 1.5, 0, state);
      // Should be finite and normalization should not change value much
      expect(valNorm).toBeCloseTo(valDefault, 6);
      expect(Number.isFinite(valPower)).toBe(true);
    });

    it('registers the strategy through helper', () => {
      const registerInterpolationStrategy = vi.fn();
      registerKaiserStrategy({ registerInterpolationStrategy });
      expect(registerInterpolationStrategy).toHaveBeenCalledWith(kaiserStrategy);
    });
  });
});
