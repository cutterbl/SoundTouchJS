import { describe, expect, it, vi } from 'vitest';

import { hannKernel, hannStrategy, registerHannStrategy } from './index.js';

describe('hann interpolation strategy', () => {
  describe('hannKernel.createState', () => {
    it('returns default state values', () => {
      const state = hannKernel.createState?.() as {
        prevSampleL: number;
        prevSampleR: number;
        params: { zeroCrossings: number };
      };

      expect(state.prevSampleL).toBe(0);
      expect(state.prevSampleR).toBe(0);
      expect(state.params.zeroCrossings).toBe(4);
    });
  });

  describe('hannKernel', () => {
    it('returns finite interpolated values for in-range positions', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 4 },
      };

      const value = hannKernel(src, 0, 4, 1.5, 0, state);
      expect(Number.isFinite(value)).toBe(true);
    });

    it('uses previous sample values before frame zero', () => {
      const src = new Float32Array([10, 20, 30, 40]);
      const state = {
        prevSampleL: 9,
        prevSampleR: 11,
        params: { zeroCrossings: 4 },
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
        params: { zeroCrossings: 4 },
      };

      const value = hannKernel(src, 0, 2, 20, 1, state);
      expect(value).toBe(40);
    });
  });

  describe('hannStrategy', () => {

    it('normalizes zeroCrossings, normalize, windowPower and applies params', () => {
      const normalizedLow = hannStrategy.normalizeParams?.(
        { zeroCrossings: 1, normalize: 0, windowPower: 0.05 },
        hannStrategy.defaultParams ?? {},
      );
      const normalizedHigh = hannStrategy.normalizeParams?.(
        { zeroCrossings: 99, normalize: 1, windowPower: 2 },
        hannStrategy.defaultParams ?? {},
      );
      const normalizedUndefined = hannStrategy.normalizeParams?.(
        undefined,
        {},
      );

      expect(normalizedLow?.zeroCrossings).toBe(2);
      expect(normalizedLow?.normalize).toBe(false);
      expect(normalizedLow?.windowPower).toBeCloseTo(0.1, 6);
      expect(normalizedHigh?.zeroCrossings).toBe(8);
      expect(normalizedHigh?.normalize).toBe(true);
      expect(normalizedHigh?.windowPower).toBe(2);
      expect(normalizedUndefined?.zeroCrossings).toBe(4);

      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { zeroCrossings: 4, normalize: false, windowPower: 1 },
      };
      hannStrategy.applyParams?.(state, { zeroCrossings: 6, normalize: 1, windowPower: 2 });
      expect(state.params.zeroCrossings).toBe(6);
      expect(state.params.normalize).toBe(true);
      expect(state.params.windowPower).toBe(2);

      expect(() => hannStrategy.applyParams?.(null, { zeroCrossings: 6 })).not.toThrow();
    });

    it('produces correct output for normalize and windowPower params', () => {
      const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      // normalize = false, windowPower = 1 (default)
      let state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, normalize: false, windowPower: 1 } };
      const valDefault = hannKernel(src, 0, 4, 1.5, 0, state);
      // normalize = true
      state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, normalize: true, windowPower: 1 } };
      const valNorm = hannKernel(src, 0, 4, 1.5, 0, state);
      // windowPower = 2
      state = { prevSampleL: 0, prevSampleR: 0, params: { zeroCrossings: 4, normalize: false, windowPower: 2 } };
      const valPower = hannKernel(src, 0, 4, 1.5, 0, state);
      // Should be finite and normalization should not change value much
      expect(valNorm).toBeCloseTo(valDefault, 6);
      expect(Number.isFinite(valPower)).toBe(true);
    });

    it('registers the strategy through helper', () => {
      const registerInterpolationStrategy = vi.fn();
      registerHannStrategy({ registerInterpolationStrategy });
      expect(registerInterpolationStrategy).toHaveBeenCalledWith(hannStrategy);
    });
  });
});
