# RateTransposer

## Import

```ts
import { RateTransposer } from '@soundtouchjs/core';
```

## Purpose

`RateTransposer` performs sample-rate transposition and interpolation as one stage of `SoundTouch` processing.

## Constructor

```ts
new RateTransposer({
  createBuffers?: boolean,
  sampleBufferAdapterFactory?: SampleBufferAdapterFactory,
  sampleBufferFactory?: () => SampleBuffer,
  interpolationStrategy?: RateTransposerInterpolationStrategy,
})
```

## Public API

- `rate` (setter)
- `strategy` (getter)
- `clear()`
- `clone()`
- `process()`
- `transpose(numFrames?)`

## Notes

- Strategy resolution is registry-driven via `interpolationStrategyRegistry`.
- Instance-level kernel state is supported when strategy kernels provide `createState()`.
