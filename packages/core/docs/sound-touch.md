# SoundTouch

## Import

```ts
import { SoundTouch } from '@soundtouchjs/core';
```

## Purpose

`SoundTouch` is the main high-level engine that combines `Stretch` and `RateTransposer` for pitch, tempo, and rate manipulation.

## Constructor

```ts
new SoundTouch({
  sampleRate?: number,
  sampleBufferType?: 'fifo' | 'circular',
  sampleBufferFactory?: SampleBufferFactory,
  interpolationStrategy?: RateTransposerInterpolationStrategy,
})
```

## Public API

- `rate` (getter/setter)
- `rateChange` (setter)
- `tempo` (getter/setter)
- `tempoChange` (setter)
- `pitch` (setter)
- `pitchOctaves` (setter)
- `pitchSemitones` (setter)
- `inputBuffer` (getter)
- `outputBuffer` (getter)
- `clear()`
- `clone()`
- `calculateEffectiveRateAndTempo()`
- `process()`

## Notes

- Pipeline order swaps automatically based on effective rate.
- `interpolationStrategy` controls transposer interpolation behavior.
