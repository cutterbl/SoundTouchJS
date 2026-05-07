# getWebAudioNode

## Import

```ts
import { getWebAudioNode } from '@soundtouchjs/core';
```

## Purpose

Creates a `ScriptProcessorNode` that reads processed frames from a `SimpleFilter` and writes them to Web Audio output channels.

## Signature

```ts
getWebAudioNode(
  context: BaseAudioContext,
  filter: SimpleFilter,
  sourcePositionCallback?: (sourcePosition: number) => void,
  bufferSize?: number,
): ScriptProcessorNode
```

## Behavior

- Pulls `bufferSize` frames from `filter.extract(...)` in each audio callback.
- Copies interleaved stereo samples into output channels.
- Calls `sourcePositionCallback` with latest source position.
- Calls `filter.onEnd()` when extraction returns zero frames.

## Notes

- Uses `ScriptProcessorNode`, which is deprecated in modern Web Audio APIs.
