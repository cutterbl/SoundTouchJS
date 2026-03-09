import { describe, it, expect } from 'vitest';
import noop from './noop.js';

describe('noop', () => {
  it('returns undefined', () => {
    expect(noop()).toBeUndefined();
  });

  it('is callable with no arguments', () => {
    expect(() => noop()).not.toThrow();
  });
});
