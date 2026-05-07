# PitchShifter

## Import

```ts
import { PitchShifter } from '@soundtouchjs/core';
```

## Purpose

`PitchShifter` is a high-level ScriptProcessorNode wrapper for real-time pitch/tempo/rate control over an `AudioBuffer` source.

## Constructor

```ts
new PitchShifter({
  context,
  buffer,
  bufferSize,
  onEnd?,
  sampleBufferType?,
  sampleBufferFactory?,
  interpolationStrategy?,
})
```

## Public API

- `formattedDuration` (getter)
- `formattedTimePlayed` (getter)
- `percentagePlayed` (getter/setter)
- `node` (getter)
- `pitch` (setter)
- `pitchSemitones` (setter)
- `rate` (setter)
- `tempo` (setter)
- `connect(toNode)`
- `disconnect()`
- `on(eventName, cb)`
- `off(eventName?)`

## Notes

- Emits `play` events with `PlayEventDetail` payloads.
- Uses `ScriptProcessorNode`, which is deprecated in modern Web Audio; prefer audio-worklet for new production integrations.
