import { describe, expect, it } from 'vitest';
import { fft, ifft } from './fft.js';

function almostEqual(a: number, b: number, tol = 1e-4): boolean {
  return Math.abs(a - b) <= tol;
}

describe('fft', () => {
  it('FFT of zeros is zeros', () => {
    const N = 8;
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    fft(re, im);
    for (let i = 0; i < N; i++) {
      expect(re[i]).toBeCloseTo(0, 5);
      expect(im[i]).toBeCloseTo(0, 5);
    }
  });

  it('FFT of DC signal (all ones) has energy only at bin 0', () => {
    const N = 16;
    const re = new Float32Array(N).fill(1);
    const im = new Float32Array(N);
    fft(re, im);
    expect(re[0]).toBeCloseTo(N, 4);
    expect(im[0]).toBeCloseTo(0, 4);
    for (let i = 1; i < N; i++) {
      expect(Math.abs(re[i])).toBeLessThan(1e-3);
      expect(Math.abs(im[i])).toBeLessThan(1e-3);
    }
  });

  it('FFT of a sinusoid places energy at the correct bin', () => {
    const N = 64;
    const k0 = 4;
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      re[n] = Math.cos((2 * Math.PI * k0 * n) / N);
    }
    fft(re, im);
    const mag = (k: number) => Math.sqrt(re[k] ** 2 + im[k] ** 2);
    expect(mag(k0)).toBeGreaterThan(N / 2 - 1);
    expect(mag(N - k0)).toBeGreaterThan(N / 2 - 1);
    for (let k = 1; k < N; k++) {
      if (k !== k0 && k !== N - k0) {
        expect(mag(k)).toBeLessThan(1e-2);
      }
    }
  });

  it('IFFT(FFT(x)) ≈ x for a random-ish signal', () => {
    const N = 32;
    const original = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      original[i] = Math.sin(i * 0.7) * 0.8 + Math.cos(i * 0.3) * 0.5;
    }
    const re = new Float32Array(original);
    const im = new Float32Array(N);
    fft(re, im);
    ifft(re, im);
    for (let i = 0; i < N; i++) {
      expect(almostEqual(re[i], original[i], 1e-4)).toBe(true);
    }
  });

  it('Parseval: energy is conserved up to scale factor N', () => {
    const N = 32;
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    for (let i = 0; i < N; i++) re[i] = Math.sin(i * 0.5);
    const timeEnergy = re.reduce((s, x) => s + x * x, 0);
    fft(re, im);
    const freqEnergy =
      re.reduce((s, x) => s + x * x, 0) +
      im.reduce((s, x) => s + x * x, 0);
    expect(Math.abs(freqEnergy / N - timeEnergy)).toBeLessThan(1e-3);
  });

  it('ifft conjugate-symmetry: imaginary part near-zero for real input', () => {
    const N = 16;
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    for (let i = 0; i < N; i++) re[i] = Math.cos(i * 0.4);
    fft(re, im);
    // Make conjugate-symmetric
    for (let k = 1; k < N / 2; k++) {
      re[N - k] = re[k];
      im[N - k] = -im[k];
    }
    ifft(re, im);
    for (let i = 0; i < N; i++) {
      expect(Math.abs(im[i])).toBeLessThan(1e-4);
    }
  });
});
