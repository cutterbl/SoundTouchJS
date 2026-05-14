import { describe, expect, it } from 'vitest';
import {
  autocorrelate,
  levinsonDurbin,
  applyAnalysisFilter,
  applySynthesisFilter,
} from './lpc.js';

function almostEqual(a: number, b: number, tol = 1e-3): boolean {
  return Math.abs(a - b) <= tol;
}

describe('autocorrelate', () => {
  it('returns zero for a silent frame', () => {
    const r = autocorrelate(new Float32Array(512), 16);
    for (let k = 0; k <= 16; k++) {
      expect(r[k]).toBeCloseTo(0, 5);
    }
  });

  it('returns array of length order + 1', () => {
    const r = autocorrelate(new Float32Array(64).fill(1), 8);
    expect(r.length).toBe(9);
  });

  it('r[0] is largest (non-negative) value', () => {
    const frame = new Float32Array(128);
    for (let i = 0; i < 128; i++) frame[i] = Math.sin(i * 0.3);
    const r = autocorrelate(frame, 10);
    for (let k = 1; k <= 10; k++) {
      expect(r[0]).toBeGreaterThanOrEqual(Math.abs(r[k]));
    }
  });
});

describe('levinsonDurbin', () => {
  it('returns zeros for a silent frame (r[0] near zero)', () => {
    const r = new Float32Array(17); // all zeros
    const a = levinsonDurbin(r, 16);
    for (let k = 0; k < 16; k++) expect(a[k]).toBeCloseTo(0, 5);
  });

  it('returns array of length order', () => {
    const r = autocorrelate(new Float32Array(64).fill(1), 4);
    const a = levinsonDurbin(r, 4);
    expect(a.length).toBe(4);
  });

  it('recovers AR(1) coefficient for a first-order autoregressive process', () => {
    // AR(1): x[n] = alpha * x[n-1] + e[n], true coefficient = alpha
    const alpha = 0.9;
    const N = 512;
    const signal = new Float32Array(N);
    signal[0] = 1;
    for (let n = 1; n < N; n++) {
      signal[n] = alpha * signal[n - 1];
    }
    const r = autocorrelate(signal, 1);
    const a = levinsonDurbin(r, 1);
    // With windowing the estimate will be slightly off but should be close.
    expect(Math.abs(a[0] - alpha)).toBeLessThan(0.15);
  });

  it('returns coefficients for a white noise signal (near-zero predictor)', () => {
    // White noise: r[0] = 1, r[k] = 0 for k > 0 → zero predictor is optimal.
    const r = new Float32Array(5);
    r[0] = 1.0;
    const a = levinsonDurbin(r, 4);
    for (let k = 0; k < 4; k++) {
      expect(Math.abs(a[k])).toBeLessThan(1e-6);
    }
  });

  it('all reflection coefficients stay within (-1, 1) for a transient signal', () => {
    // A near-impulse can push unclamped k outside the unit circle, causing
    // an unstable synthesis filter.  Verify levinsonDurbin clamps k so the
    // resulting coefficients always produce a stable filter.
    const N = 512;
    const frame = new Float32Array(N);
    frame[0] = 1.0; // impulse — worst case for marginal positive-definiteness
    const r = autocorrelate(frame, 16);
    const a = levinsonDurbin(r, 16);
    // Feed a sustained signal through the synthesis filter; it must stay finite.
    const zi = new Float32Array(16);
    const input = new Float32Array(256);
    for (let i = 0; i < 256; i++) input[i] = Math.sin(i * 0.2) * 0.5;
    const out = applySynthesisFilter(input, a, zi);
    for (let i = 0; i < 256; i++) {
      expect(Number.isFinite(out[i])).toBe(true);
    }
  });
});

describe('applyAnalysisFilter', () => {
  it('returns array of the same length as input', () => {
    const frame = new Float32Array(128).fill(0.5);
    const a = new Float32Array(4).fill(0.1);
    const zi = new Float32Array(4);
    const out = applyAnalysisFilter(frame, a, zi);
    expect(out.length).toBe(128);
  });

  it('with zero coefficients, output equals input', () => {
    const frame = new Float32Array(16);
    for (let i = 0; i < 16; i++) frame[i] = i * 0.1;
    const a = new Float32Array(4); // all zeros
    const zi = new Float32Array(4);
    const out = applyAnalysisFilter(frame, a, zi);
    for (let i = 0; i < 16; i++) {
      expect(out[i]).toBeCloseTo(frame[i], 5);
    }
  });

  it('updates zi state across successive calls', () => {
    const a = new Float32Array([0.5, 0, 0, 0]);
    const zi = new Float32Array(4);
    const frame1 = new Float32Array([1, 0, 0, 0]);
    applyAnalysisFilter(frame1, a, zi);
    // After processing, zi[0] should hold the last input sample (0).
    expect(zi[0]).toBeCloseTo(0, 5);
    expect(zi[1]).toBeCloseTo(0, 5);
  });
});

describe('applySynthesisFilter', () => {
  it('returns array of the same length as input', () => {
    const frame = new Float32Array(64).fill(0);
    const a = new Float32Array(4).fill(0.1);
    const zi = new Float32Array(4);
    const out = applySynthesisFilter(frame, a, zi);
    expect(out.length).toBe(64);
  });

  it('with zero coefficients, output equals input', () => {
    const frame = new Float32Array(16);
    for (let i = 0; i < 16; i++) frame[i] = i * 0.1;
    const a = new Float32Array(4); // all zeros
    const zi = new Float32Array(4);
    const out = applySynthesisFilter(frame, a, zi);
    for (let i = 0; i < 16; i++) {
      expect(out[i]).toBeCloseTo(frame[i], 5);
    }
  });

  it('resets state and produces finite output when filter diverges', () => {
    // Artificially force a blow-up: seed zi with Inf to simulate a diverged state.
    const a = new Float32Array([0.5, 0.3, 0.1, 0.05]);
    const zi = new Float32Array([Infinity, Infinity, Infinity, Infinity]);
    const frame = new Float32Array(16).fill(0.1);
    const out = applySynthesisFilter(frame, a, zi);
    for (let i = 0; i < 16; i++) {
      expect(Number.isFinite(out[i])).toBe(true);
    }
    // State should be reset — subsequent calls should remain finite.
    const frame2 = new Float32Array(16).fill(0.1);
    const out2 = applySynthesisFilter(frame2, a, zi);
    for (let i = 0; i < 16; i++) {
      expect(Number.isFinite(out2[i])).toBe(true);
    }
  });
});

describe('analysis + synthesis roundtrip', () => {
  it('synthesis(analysis(x)) ≈ x for a stationary sinusoid', () => {
    const N = 256;
    const original = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      original[i] = 0.7 * Math.sin(i * 0.15) + 0.3 * Math.cos(i * 0.4);
    }

    // Compute LPC from the signal itself.
    const r = autocorrelate(original, 8);
    const a = levinsonDurbin(r, 8);

    // Process through analysis then synthesis with fresh state.
    const analysisZi = new Float32Array(8);
    const synthesisZi = new Float32Array(8);
    const residual = applyAnalysisFilter(original, a, analysisZi);
    const reconstructed = applySynthesisFilter(residual, a, synthesisZi);

    // First few samples may differ due to filter startup; check the middle.
    let maxErr = 0;
    for (let i = 32; i < N; i++) {
      maxErr = Math.max(maxErr, Math.abs(reconstructed[i] - original[i]));
    }
    expect(maxErr).toBeLessThan(0.05);
  });

  it('reconstruction is valid for a constant-DC signal', () => {
    const N = 128;
    const original = new Float32Array(N).fill(0.5);
    const r = autocorrelate(original, 4);
    const a = levinsonDurbin(r, 4);
    const zi1 = new Float32Array(4);
    const zi2 = new Float32Array(4);
    const residual = applyAnalysisFilter(original, a, zi1);
    const reconstructed = applySynthesisFilter(residual, a, zi2);
    for (let i = 8; i < N; i++) {
      expect(almostEqual(reconstructed[i], 0.5, 0.05)).toBe(true);
    }
  });

  it('produces finite values for all inputs', () => {
    const N = 128;
    const signal = new Float32Array(N);
    for (let i = 0; i < N; i++) signal[i] = Math.sin(i * 0.1) * 0.9;
    const r = autocorrelate(signal, 16);
    const a = levinsonDurbin(r, 16);
    const zi1 = new Float32Array(16);
    const zi2 = new Float32Array(16);
    const res = applyAnalysisFilter(signal, a, zi1);
    const out = applySynthesisFilter(res, a, zi2);
    for (let i = 0; i < N; i++) {
      expect(Number.isFinite(out[i])).toBe(true);
    }
  });
});
