import { describe, expect, it } from 'vitest';
import * as AudioWorkletPackage from './index.js';

describe('audio-worklet public exports', () => {
  it('exposes the expected runtime symbols', () => {
    const runtimeKeys = Object.keys(AudioWorkletPackage).sort();

    expect(runtimeKeys).toEqual(['PROCESSOR_NAME', 'SoundTouchNode']);
  });
});
