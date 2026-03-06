import { describe, it, expect } from 'vitest';
import { PROCESSOR_NAME } from './constants.js';

describe('constants', () => {
  it('exports the processor name', () => {
    expect(PROCESSOR_NAME).toBe('soundtouch-processor');
  });
});
