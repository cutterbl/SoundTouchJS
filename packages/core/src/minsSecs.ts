/*
 * SoundTouch JS audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 * Copyright (c) Jakub Fiala
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

function pad(n: number, width: number, z = '0'): string {
  const s = String(n);
  return s.length >= width ? s : new Array(width - s.length + 1).join(z) + s;
}

/**
 * Converts a number of seconds to a string in "minutes:seconds" format.
 *
 * @param secs Number of seconds to convert.
 * @returns A string formatted as "m:ss".
 * @example
 * minsSecs(125) // "2:05"
 */
export default function minsSecs(secs: number): string {
  const mins = Math.floor(secs / 60);
  const seconds = secs - mins * 60;
  return `${mins}:${pad(Math.floor(seconds), 2)}`;
}
