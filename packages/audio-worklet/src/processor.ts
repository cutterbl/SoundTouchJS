/*
 * SoundTouch JS audio processing library
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
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

import { SoundTouch } from '@soundtouchjs/core';

const PROCESSOR_NAME = 'soundtouch-processor';

interface ParameterDescriptor {
  name: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  automationRate: 'k-rate' | 'a-rate';
}

class SoundTouchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): ParameterDescriptor[] {
    return [
      {
        name: 'pitch',
        defaultValue: 1.0,
        minValue: 0.25,
        maxValue: 4.0,
        automationRate: 'k-rate',
      },
      {
        name: 'tempo',
        defaultValue: 1.0,
        minValue: 0.25,
        maxValue: 4.0,
        automationRate: 'k-rate',
      },
      {
        name: 'rate',
        defaultValue: 1.0,
        minValue: 0.25,
        maxValue: 4.0,
        automationRate: 'k-rate',
      },
      {
        name: 'pitchSemitones',
        defaultValue: 0,
        minValue: -24,
        maxValue: 24,
        automationRate: 'k-rate',
      },
    ];
  }

  private _pipe: SoundTouch;
  private _samples: Float32Array;
  private _outputSamples: Float32Array;

  constructor() {
    super();
    this._pipe = new SoundTouch();
    this._samples = new Float32Array(128 * 2);
    this._outputSamples = new Float32Array(128 * 2);
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length || !output[0] || !output[0].length) {
      return true;
    }

    const leftInput = input[0];
    const rightInput = input.length > 1 ? input[1] : input[0];
    const leftOutput = output[0];
    const rightOutput = output.length > 1 ? output[1] : output[0];
    const frameCount = leftInput.length;

    if (this._samples.length < frameCount * 2) {
      this._samples = new Float32Array(frameCount * 2);
      this._outputSamples = new Float32Array(frameCount * 2);
    }

    const rate = parameters['rate'][0];
    const tempo = parameters['tempo'][0];
    const pitch = parameters['pitch'][0];
    const pitchSemitones = parameters['pitchSemitones'][0];

    this._pipe.rate = rate;
    this._pipe.tempo = tempo;
    this._pipe.pitch = pitch * Math.pow(2, pitchSemitones / 12);

    const samples = this._samples;

    for (let i = 0; i < frameCount; i++) {
      samples[i * 2] = leftInput[i];
      samples[i * 2 + 1] = rightInput[i];
    }

    this._pipe.inputBuffer.putSamples(samples, 0, frameCount);
    this._pipe.process();

    const outputBuffer = this._pipe.outputBuffer;
    const available = outputBuffer.frameCount;
    const toExtract = Math.min(available, frameCount);

    if (toExtract > 0) {
      const extracted = this._outputSamples;
      outputBuffer.receiveSamples(extracted, toExtract);
      for (let i = 0; i < toExtract; i++) {
        const l = extracted[i * 2];
        const r = extracted[i * 2 + 1];
        leftOutput[i] = Number.isFinite(l) ? l : 0;
        rightOutput[i] = Number.isFinite(r) ? r : 0;
      }
    }

    for (let i = toExtract; i < frameCount; i++) {
      leftOutput[i] = 0;
      rightOutput[i] = 0;
    }

    return true;
  }
}

registerProcessor(PROCESSOR_NAME, SoundTouchProcessor);
