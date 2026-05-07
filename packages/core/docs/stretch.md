# Stretch

## Import

```ts
import { Stretch } from '@soundtouchjs/core';
```

## Purpose

`Stretch` is the TDStretch-style time-stretch stage used to change tempo without changing pitch.

## Constructor

```ts
new Stretch({
  createBuffers?: boolean,
  inputBufferAdapterFactory?: () => StretchReadBufferAdapter,
  sampleBufferFactory?: () => SampleBuffer,
})
```

## Public API

- `tempo` (getter/setter)
- `inputChunkSize` (getter)
- `outputChunkSize` (getter)
- `quickSeek` (setter)
- `clear()`
- `clearMidBuffer()`
- `setParameters(sampleRate, sequenceMs, seekWindowMs, overlapMs)`
- `calculateOverlapLength(overlapInMsec?)`
- `clone()`
- `seekBestOverlapPosition(inputBuffer?)`
- `process()`

## Notes

- Uses overlap-add with best-overlap search across a seek window.
- Quick-seek mode uses staged scan offsets and can fall back to full seek when candidate coverage is sparse.
- Supports both FIFO and circular input adapter paths.
