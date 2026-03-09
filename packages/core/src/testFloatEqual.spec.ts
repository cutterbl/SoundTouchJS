import { describe, it, expect } from 'vitest';
import testFloatEqual from './testFloatEqual.js';

describe('testFloatEqual', () => {
  it('returns false for identical values', () => {
    expect(testFloatEqual(1.0, 1.0)).toBe(false);
  });

  it('returns false for values within epsilon (1e-10)', () => {
    expect(testFloatEqual(1.0, 1.0 + 1e-11)).toBe(false);
  });

  it('returns true for values differing by more than epsilon', () => {
    expect(testFloatEqual(1.0, 1.0 + 1e-9)).toBe(true);
  });

  it('is symmetric (a,b same as b,a)', () => {
    expect(testFloatEqual(1.0, 2.0)).toBe(testFloatEqual(2.0, 1.0));
  });

  it('returns true for clearly different values', () => {
    expect(testFloatEqual(0, 1)).toBe(true);
  });

  it('returns false for zero and zero', () => {
    expect(testFloatEqual(0, 0)).toBe(false);
  });

  it('handles negative values', () => {
    expect(testFloatEqual(-1.0, -1.0)).toBe(false);
    expect(testFloatEqual(-1.0, 1.0)).toBe(true);
  });
});
