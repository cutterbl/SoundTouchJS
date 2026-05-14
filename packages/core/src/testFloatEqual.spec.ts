import { describe, it, expect } from 'vitest';
import isFloatDifferent from './testFloatEqual.js';

describe('isFloatDifferent', () => {
  it('returns false for identical values', () => {
    expect(isFloatDifferent(1.0, 1.0)).toBe(false);
  });

  it('returns false for values within epsilon (1e-10)', () => {
    expect(isFloatDifferent(1.0, 1.0 + 1e-11)).toBe(false);
  });

  it('returns true for values differing by more than epsilon', () => {
    expect(isFloatDifferent(1.0, 1.0 + 1e-9)).toBe(true);
  });

  it('is symmetric (a,b same as b,a)', () => {
    expect(isFloatDifferent(1.0, 2.0)).toBe(isFloatDifferent(2.0, 1.0));
  });

  it('returns true for clearly different values', () => {
    expect(isFloatDifferent(0, 1)).toBe(true);
  });

  it('returns false for zero and zero', () => {
    expect(isFloatDifferent(0, 0)).toBe(false);
  });

  it('handles negative values', () => {
    expect(isFloatDifferent(-1.0, -1.0)).toBe(false);
    expect(isFloatDifferent(-1.0, 1.0)).toBe(true);
  });
});
