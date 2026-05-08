import { describe, expect, it, vi } from 'vitest';

import { hannKernel, hannStrategy, registerHannStrategy } from './index.js';

describe('hann interpolation strategy', () => {
  describe('hannKernel.createState', () => {
    it('returns default state values', () => {
      const state = hannKernel.createState?.() as {
        prevSampleL: number;
        prevSampleR: number;
        params: { radius: number };
      };

      expect(state.prevSampleL).toBe(0);
      expect(state.prevSampleR).toBe(0);
      expect(state.params.radius).toBe(4);
    });
  });

  describe('hannKernel', () => {
    it('returns finite interpolated values for in-range positions', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { radius: 4 },
      };

      const value = hannKernel(src, 0, 4, 1.5, 0, state);
      expect(Number.isFinite(value)).toBe(true);
    });

    it('uses previous sample values before frame zero', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 9,
        prevSampleR: 11,
        params: { radius: 4 },
      };

      const leftValue = hannKernel(src, 0, 2, -0.25, 0, state);
      const rightValue = hannKernel(src, 0, 2, -0.25, 1, state);

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
        params: { radius: 4 },
      };

      const value = hannKernel(src, 0, 2, 20, 1, state);
      expect(value).toBe(40);
    });
  });

  describe('hannStrategy', () => {
    it('normalizes radius and applies params', () => {
      const normalizedLow = hannStrategy.normalizeParams?.(
        { radius: 1 },
        hannStrategy.defaultParams ?? {},
      );
      const normalizedHigh = hannStrategy.normalizeParams?.(
        { radius: 99 },
        hannStrategy.defaultParams ?? {},
      );
      const normalizedUndefined = hannStrategy.normalizeParams?.(
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
      hannStrategy.applyParams?.(state, { radius: 6 });
      expect(state.params.radius).toBe(6);

      expect(() => hannStrategy.applyParams?.(null, { radius: 6 })).not.toThrow();
    });

    it('registers the strategy through helper', () => {
      const registerInterpolationStrategy = vi.fn();
      registerHannStrategy({ registerInterpolationStrategy });
      expect(registerInterpolationStrategy).toHaveBeenCalledWith(hannStrategy);
    });
  });
});
