/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Generates a Hann window of the given size.
 *
 * @remarks
 * Uses the symmetric form `0.5 * (1 − cos(2πn / (N−1)))` for N > 1.
 * For `size = 1` the single coefficient is `1.0`.
 * The phase vocoder applies this window at both analysis and synthesis
 * (WOLA), where the accumulated squared-window sum at 75 % overlap is ≈ 1.5;
 * it normalizes per sample from that accumulated sum rather than by a
 * constant, so the symmetric (non-COLA) form's ripple is normalized out.
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
