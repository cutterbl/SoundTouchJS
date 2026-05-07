import { describe, it, expect } from 'vitest';
import { DEFAULT_SAMPLE_BUFFER_TYPE, PROCESSOR_NAME } from './constants.js';

describe('constants', () => {
  it('exports the processor name', () => {
    expect(PROCESSOR_NAME).toBe('soundtouch-processor');
  });

  it('defaults to circular sample buffers', () => {
    expect(DEFAULT_SAMPLE_BUFFER_TYPE).toBe('circular');
  });
});
