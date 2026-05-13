import { describe, expect, it } from 'vitest';
import * as PhaseVocoderWorkletPackage from './index.js';

describe('phase-vocoder-worklet public exports', () => {
  it('exposes the expected runtime symbols', () => {
    const runtimeKeys = Object.keys(PhaseVocoderWorkletPackage).sort();
    expect(runtimeKeys).toEqual(['PROCESSOR_NAME', 'PhaseVocoderNode']);
  });
});
