/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License.
 */

/**
 * In-place radix-2 Cooley-Tukey FFT.
 *
 * @remarks
 * Transforms `re` and `im` in-place. Both arrays must have the same length,
 * which must be a power of two (512–4096). Inputs outside these constraints
 * produce undefined results.
 *
 * @param re Real part — modified in-place.
 * @param im Imaginary part — modified in-place.
 */
export function fft(re: Float32Array, im: Float32Array): void {
  const N = re.length;

  // Bit-reverse permutation
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }

  // Butterfly stages
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wBaseRe = Math.cos(ang);
    const wBaseIm = Math.sin(ang);

    for (let i = 0; i < N; i += len) {
      let wRe = 1.0;
      let wIm = 0.0;
      for (let k = 0; k < halfLen; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + halfLen] * wRe - im[i + k + halfLen] * wIm;
        const vIm = re[i + k + halfLen] * wIm + im[i + k + halfLen] * wRe;

        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + halfLen] = uRe - vRe;
        im[i + k + halfLen] = uIm - vIm;

        const nextWRe = wRe * wBaseRe - wIm * wBaseIm;
        wIm = wRe * wBaseIm + wIm * wBaseRe;
        wRe = nextWRe;
      }
    }
  }
}

/**
 * In-place inverse FFT via conjugate-forward-conjugate-scale.
 *
 * @remarks
 * Modifies `re` and `im` in-place. Both arrays must be the same power-of-two
 * length. The imaginary part of the output is numerically near-zero for
 * real-valued inputs and can be discarded.
 *
 * @param re Real part — modified in-place.
 * @param im Imaginary part — modified in-place.
 */
export function ifft(re: Float32Array, im: Float32Array): void {
  const N = re.length;
  // Conjugate input
  for (let i = 0; i < N; i++) {
    im[i] = -im[i];
  }
  fft(re, im);
  // Conjugate and scale
  const inv = 1.0 / N;
  for (let i = 0; i < N; i++) {
    re[i] *= inv;
    im[i] = -im[i] * inv;
  }
}
