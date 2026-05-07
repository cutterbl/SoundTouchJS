# WebAudioBufferSource

## Import

```ts
import { WebAudioBufferSource } from '@soundtouchjs/core';
```

## Purpose

`WebAudioBufferSource` adapts a browser `AudioBuffer` to the extraction contract expected by `SimpleFilter`.

## Constructor

```ts
new WebAudioBufferSource(buffer: AudioBuffer)
```

## Public API

- `dualChannel` (getter)
- `position` (getter/setter)
- `extract(target, numFrames?, position?)`

## Notes

- Output is interleaved stereo.
- Mono sources are duplicated to both channels.
