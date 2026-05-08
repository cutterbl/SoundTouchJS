import { describe, expect, it, vi } from 'vitest';

import { kaiserKernel, kaiserStrategy, registerKaiserStrategy } from './index.js';

describe('kaiser interpolation strategy', () => {
  describe('kaiserKernel.createState', () => {
    it('returns default state values', () => {
      const state = kaiserKernel.createState?.() as {
        prevSampleL: number;
        prevSampleR: number;
        params: { radius: number; beta: number };
      };

      expect(state.prevSampleL).toBe(0);
      expect(state.prevSampleR).toBe(0);
      expect(state.params.radius).toBe(4);
      expect(state.params.beta).toBeCloseTo(8.6, 6);
    });
  });

  describe('kaiserKernel', () => {
    it('returns finite interpolated values for in-range positions', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { radius: 4, beta: 8.6 },
      };

      const value = kaiserKernel(src, 0, 4, 1.5, 0, state);
      expect(Number.isFinite(value)).toBe(true);
    });

    it('uses previous sample values before frame zero', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 9,
        prevSampleR: 11,
        params: { radius: 4, beta: 8.6 },
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
        params: { radius: 4, beta: 8.6 },
      };

      const value = kaiserKernel(src, 0, 2, 20, 1, state);
      expect(value).toBe(40);
    });

    it('falls back to rounded frame read when weights collapse', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { radius: 0, beta: 8.6 },
      };

      const value = kaiserKernel(src, 0, 2, 0.49, 0, state);
      expect(value).toBe(10);
    });
  });

  describe('kaiserStrategy', () => {
    it('normalizes params and applies them to state', () => {
      const normalizedLow = kaiserStrategy.normalizeParams?.(
        { radius: 1, beta: -2 },
        kaiserStrategy.defaultParams ?? {},
      );
      const normalizedHigh = kaiserStrategy.normalizeParams?.(
        { radius: 99, beta: 50 },
        kaiserStrategy.defaultParams ?? {},
      );
      const normalizedUndefined = kaiserStrategy.normalizeParams?.(
        undefined,
        {},
      );

      expect(normalizedLow?.radius).toBe(2);
      expect(normalizedLow?.beta).toBe(0);
      expect(normalizedHigh?.radius).toBe(16);
      expect(normalizedHigh?.beta).toBe(20);
      expect(normalizedUndefined?.radius).toBe(4);
      expect(normalizedUndefined?.beta).toBeCloseTo(8.6, 6);

      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { radius: 4, beta: 8.6 },
      };
      kaiserStrategy.applyParams?.(state, { radius: 6, beta: 12 });
      expect(state.params.radius).toBe(6);
      expect(state.params.beta).toBe(12);

      expect(() =>
        kaiserStrategy.applyParams?.(null, { radius: 6, beta: 12 }),
      ).not.toThrow();
    });

    it('registers the strategy through helper', () => {
      const registerInterpolationStrategy = vi.fn();
      registerKaiserStrategy({ registerInterpolationStrategy });
      expect(registerInterpolationStrategy).toHaveBeenCalledWith(kaiserStrategy);
    });
  });
});
