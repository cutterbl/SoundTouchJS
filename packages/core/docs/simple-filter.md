# SimpleFilter

## Import

```ts
import { SimpleFilter } from '@soundtouchjs/core';
```

## Purpose

`SimpleFilter` pulls audio frames from a source object, runs them through a `SamplePipe`, and provides extracted output frames.

## Constructor

```ts
new SimpleFilter({
  sourceSound,
  pipe,
  callback?,
})
```

## Public API

- `position` (getter/setter)
- `sourcePosition` (getter/setter)
- `onEnd()`
- `fillInputBuffer(numFrames?)`
- `extract(target, numFrames?)`
- `handleSampleData(event)`
- `clear()`

## Notes

- The source object must implement `extract(target, numFrames, position)`.
- Maintains a history window to support limited backward seeking via `position` setter.
