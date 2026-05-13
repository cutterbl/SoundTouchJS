/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 */

/**
 * Generates a Hann window of the given size.
 *
 * @remarks
 * Uses the symmetric form `0.5 * (1 − cos(2πn / (N−1)))` for N > 1.
 * For `size = 1` the single coefficient is `1.0`.
 * When used with overlap-add, 75 % overlap (factor 4) yields a normalization
 * constant of 2 (sum of four Hann windows = 2).
 *
 * @param size Number of coefficients.
 * @returns Float32Array of length `size`.
 */
export function makeHannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  if (size === 1) {
    w[0] = 1.0;
    return w;
  }
  const denom = size - 1;
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / denom));
  }
  return w;
}
