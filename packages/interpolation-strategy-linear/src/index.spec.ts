import { describe, expect, it, vi } from 'vitest';

import { linearKernel, linearStrategy, registerLinearStrategy } from './index.js';

describe('linear interpolation strategy', () => {
  describe('linearKernel.createState', () => {
    it('returns default state values', () => {
      const state = linearKernel.createState?.() as {
        prevSampleL: number;
        prevSampleR: number;
        params: { edgeHoldFrames: number };
      };

      expect(state.prevSampleL).toBe(0);
      expect(state.prevSampleR).toBe(0);
      expect(state.params.edgeHoldFrames).toBe(1);
    });
  });

  describe('linearKernel', () => {
    it('interpolates between neighboring frames in-range', () => {
      const src = new Float32Array([0, 10, 10, 20]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { edgeHoldFrames: 1 },
      };

      const value = linearKernel(src, 0, 2, 0.5, 0, state);
      expect(value).toBeCloseTo(5, 6);
    });

    it('uses previous sample for near-negative index and zero for far-negative index', () => {
      const src = new Float32Array([1, 2, 3, 4]);
      const state = {
        prevSampleL: 7,
        prevSampleR: 8,
        params: { edgeHoldFrames: 1 },
      };

      const nearValue = linearKernel(src, 0, 2, -0.2, 0, state);
      const nearRightValue = linearKernel(src, 0, 2, -0.2, 1, state);
      const farValue = linearKernel(src, 0, 2, -2.2, 0, state);

      expect(nearValue).toBeCloseTo(2.2, 6);
      expect(nearRightValue).toBeCloseTo(3.2, 6);
      expect(farValue).toBe(0);
    });

    it('uses edge sample for near-overrun and zero for far-overrun', () => {
      const src = new Float32Array([1, 2, 3, 4]);
      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { edgeHoldFrames: 1 },
      };

      const nearValue = linearKernel(src, 0, 2, 1.2, 1, state);
      const farValue = linearKernel(src, 0, 2, 3.2, 1, state);

      expect(nearValue).toBeCloseTo(4, 6);
      expect(farValue).toBe(0);
    });
  });

  describe('linearStrategy', () => {
    it('normalizes edgeHoldFrames and applies params to state', () => {
      const normalizedLow = linearStrategy.normalizeParams?.(
        { edgeHoldFrames: -10 },
        linearStrategy.defaultParams ?? {},
      );
      const normalizedHigh = linearStrategy.normalizeParams?.(
        { edgeHoldFrames: 100 },
        linearStrategy.defaultParams ?? {},
      );
      const normalizedFallback = linearStrategy.normalizeParams?.(
        undefined,
        {},
      );

      expect(normalizedLow?.edgeHoldFrames).toBe(0);
      expect(normalizedHigh?.edgeHoldFrames).toBe(32);
      expect(normalizedFallback?.edgeHoldFrames).toBe(1);

      const state = {
        prevSampleL: 0,
        prevSampleR: 0,
        params: { edgeHoldFrames: 1 },
      };
      linearStrategy.applyParams?.(state, { edgeHoldFrames: 5 });
      expect(state.params.edgeHoldFrames).toBe(5);

      expect(() =>
        linearStrategy.applyParams?.(undefined, { edgeHoldFrames: 5 }),
      ).not.toThrow();
      expect(() =>
        linearStrategy.applyParams?.(null, { edgeHoldFrames: 5 }),
      ).not.toThrow();
    });

    it('registers the strategy through helper', () => {
      const registerInterpolationStrategy = vi.fn();
      registerLinearStrategy({ registerInterpolationStrategy });
      expect(registerInterpolationStrategy).toHaveBeenCalledWith(linearStrategy);
    });
  });
});
