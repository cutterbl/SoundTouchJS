# FilterSupport

## Import

```ts
import { FilterSupport } from '@soundtouchjs/core';
```

## Purpose

`FilterSupport` wraps a `SamplePipe` and provides utility flow for filling and processing output buffers.

## Constructor

```ts
new FilterSupport(pipe: SamplePipe)
```

## Public API

- `pipe` (getter)
- `inputBuffer` (getter)
- `outputBuffer` (getter)
- `fillInputBuffer(numFrames)`
- `fillOutputBuffer(numFrames?)`
- `clear()`

## Notes

- `fillInputBuffer` is intended to be overridden.
- `fillOutputBuffer` repeatedly fills/processes until enough output is available or input runs out.
