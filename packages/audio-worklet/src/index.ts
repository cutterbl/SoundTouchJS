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
/**
 * Main entry point for the SoundTouch audio-worklet package.
 *
 * @remarks
 * Re-exports the SoundTouchNode class, its options types, and the processor name constant for use in host applications.
 */
export { SoundTouchNode } from './SoundTouchNode.js';
export type {
  SoundTouchNodeConstructorOptions,
  SoundTouchNodeOptions,
} from './SoundTouchNode.js';
export { PROCESSOR_NAME } from './constants.js';
