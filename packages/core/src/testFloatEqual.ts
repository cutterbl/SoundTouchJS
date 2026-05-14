/*
 * SoundTouch JS audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 * Copyright (c) Jakub Fiala
 * Copyright (c) Steve 'Cutter' Blades
 *
 * Licensed under the Mozilla Public License, v. 2.0.
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Tests whether two floating-point numbers differ beyond a fixed epsilon.
 *
 * @param a First number to compare.
 * @param b Second number to compare.
 * @returns True when the numbers differ by more than epsilon, false otherwise.
 * @remarks
 * Uses a fixed epsilon threshold to determine significant difference.
 */
export default function isFloatDifferent(a: number, b: number): boolean {
  return (a > b ? a - b : b - a) > 1e-10;
}
