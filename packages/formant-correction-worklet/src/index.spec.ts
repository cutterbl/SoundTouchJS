import { describe, expect, it } from 'vitest';
import * as pkg from './index.js';

describe('formant-correction-worklet public exports', () => {
  it('exposes the expected runtime symbols', () => {
    const keys = Object.keys(pkg).sort();
    expect(keys).toEqual([
      'FormantCorrectionNode',
      'LPC_ORDER',
      'LPC_WINDOW',
      'PROCESSOR_NAME',
      'applyAnalysisFilter',
      'applySynthesisFilter',
      'autocorrelate',
      'levinsonDurbin',
      'processOffline',
    ]);
  });
});
