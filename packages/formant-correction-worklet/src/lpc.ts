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
 * Computes the biased autocorrelation of `frame` for lags 0..`order`.
 *
 * @remarks
 * A symmetric Hamming window is applied before computing the autocorrelation
 * to reduce spectral leakage at frame boundaries. The result is a length-`(order+1)`
 * array where index `k` corresponds to lag `k`.
 *
 * @param frame - Input signal frame.
 * @param order - LPC predictor order; returned array has length `order + 1`.
 * @returns Autocorrelation coefficients `r[0..order]`.
 */
export function autocorrelate(
  frame: Float32Array,
  order: number,
): Float32Array {
  const N = frame.length;
  const windowed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    windowed[i] =
      frame[i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1)));
  }

  const r = new Float32Array(order + 1);
  for (let k = 0; k <= order; k++) {
    let sum = 0;
    for (let n = 0; n < N - k; n++) {
      sum += windowed[n] * windowed[n + k];
    }
    r[k] = sum;
  }
  return r;
}

/**
 * Computes LPC predictor coefficients from an autocorrelation vector using
 * the Levinson-Durbin recursion.
 *
 * @remarks
 * Returns the predictor coefficients `a[0..order-1]` (0-based index corresponds
 * to predictor lag 1..`order`) such that the predictor is:
 * ```
 * x̂[n] = a[0]*x[n-1] + a[1]*x[n-2] + ... + a[order-1]*x[n-order]
 * ```
 * Returns a zero vector if the signal is silent (`r[0] < 1e-10`).
 *
 * @param r - Autocorrelation array from {@link autocorrelate} (length `order + 1`).
 * @param order - Number of predictor coefficients to compute.
 * @returns LPC predictor coefficients `a[0..order-1]`.
 */
export function levinsonDurbin(
  r: Float32Array,
  order: number,
): Float32Array {
  const a = new Float32Array(order);
  if (r[0] < 1e-10) return a;

  const aPrev = new Float32Array(order);
  let E = r[0];

  for (let m = 1; m <= order; m++) {
    // Reflection coefficient for order m.
    let num = r[m];
    for (let j = 0; j < m - 1; j++) {
      num -= a[j] * r[m - 1 - j];
    }
    if (Math.abs(E) < 1e-15) break;
    const k = num / E;

    // Save current coefficients before updating.
    for (let j = 0; j < m - 1; j++) aPrev[j] = a[j];

    // Update all coefficients for order m.
    for (let j = 0; j < m - 1; j++) {
      a[j] = aPrev[j] - k * aPrev[m - 2 - j];
    }
    a[m - 1] = k;

    E *= 1 - k * k;
    if (E < 1e-15) break;
  }

  return a;
}

/**
 * Applies the LPC analysis (whitening) FIR filter to a signal frame in-place.
 *
 * @remarks
 * Computes the prediction residual:
 * ```
 * e[n] = x[n] − a[0]·x[n−1] − a[1]·x[n−2] − … − a[p−1]·x[n−p]
 * ```
 * The filter state `zi` (length `order`) holds the `order` most recent input
 * samples (`zi[0]` = x[n−1], `zi[1]` = x[n−2], …) and is updated in-place
 * so the state carries over across successive calls.
 *
 * @param frame - Input signal samples.
 * @param a - LPC predictor coefficients from {@link levinsonDurbin}.
 * @param zi - Filter memory (modified in-place). Allocate as `new Float32Array(order)`.
 * @returns New array containing the whitened residual signal.
 */
export function applyAnalysisFilter(
  frame: Float32Array,
  a: Float32Array,
  zi: Float32Array,
): Float32Array {
  const order = a.length;
  const out = new Float32Array(frame.length);
  for (let n = 0; n < frame.length; n++) {
    let e = frame[n];
    for (let k = 0; k < order; k++) {
      e -= a[k] * zi[k];
    }
    out[n] = e;
    // Shift state: newest input goes to zi[0].
    for (let k = order - 1; k > 0; k--) {
      zi[k] = zi[k - 1];
    }
    zi[0] = frame[n];
  }
  return out;
}

/**
 * Applies the LPC synthesis (coloring) IIR filter to a residual frame.
 *
 * @remarks
 * Reconstructs a colored signal from the residual:
 * ```
 * y[n] = e[n] + a[0]·y[n−1] + a[1]·y[n−2] + … + a[p−1]·y[n−p]
 * ```
 * The filter state `zi` (length `order`) holds the `order` most recent output
 * samples (`zi[0]` = y[n−1], `zi[1]` = y[n−2], …) and is updated in-place.
 *
 * Combined with {@link applyAnalysisFilter} using the same coefficients,
 * this reconstructs the original signal: `synthesis(analysis(x)) ≈ x`.
 *
 * @param frame - Residual signal (output of the analysis filter).
 * @param a - LPC predictor coefficients from {@link levinsonDurbin}.
 * @param zi - Filter memory (modified in-place). Allocate as `new Float32Array(order)`.
 * @returns New array containing the re-colored output signal.
 */
export function applySynthesisFilter(
  frame: Float32Array,
  a: Float32Array,
  zi: Float32Array,
): Float32Array {
  const order = a.length;
  const out = new Float32Array(frame.length);
  for (let n = 0; n < frame.length; n++) {
    let y = frame[n];
    for (let k = 0; k < order; k++) {
      y += a[k] * zi[k];
    }
    out[n] = y;
    // Shift state: newest output goes to zi[0].
    for (let k = order - 1; k > 0; k--) {
      zi[k] = zi[k - 1];
    }
    zi[0] = y;
  }
  return out;
}
