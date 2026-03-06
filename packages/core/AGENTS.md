# @soundtouchjs/core

Publishable audio processing library. Zero runtime dependencies.

## Signal Chain

```
WebAudioBufferSource → SimpleFilter → SoundTouch → getWebAudioNode → ScriptProcessorNode
                                       ├─ Stretch (time-stretch via WSOLA)
                                       └─ RateTransposer (sample rate transposition)
```

`PitchShifter` is the high-level consumer API that wires this chain together.

## Module Structure

| Module                   | Role                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| `SoundTouch`             | Core engine — owns `Stretch` + `RateTransposer`, exposes `rate`, `tempo`, `pitch` |
| `PitchShifter`           | Consumer-facing class — manages Web Audio node lifecycle, events, playback state  |
| `Stretch`                | WSOLA time-stretching algorithm with overlap-add                                  |
| `RateTransposer`         | Linear interpolation sample rate conversion                                       |
| `FifoSampleBuffer`       | Float32Array ring buffer for interleaved stereo samples                           |
| `AbstractFifoSamplePipe` | Base class for pipe stages with input/output buffers                              |
| `FilterSupport`          | Abstract filter base; defines `SamplePipe` interface                              |
| `SimpleFilter`           | Connects a `WebAudioBufferSource` to a `SoundTouch` pipe                          |
| `WebAudioBufferSource`   | Adapter that reads from an `AudioBuffer`                                          |
| `getWebAudioNode`        | Factory that creates a `ScriptProcessorNode` wired to a filter                    |

## Build

TSC compiles `src/` → `dist/` (JS + `.d.ts` + source maps). Configured in `tsconfig.lib.json`.

Published package exposes:

- `dist/index.js` (ESM)
- `dist/index.d.ts` (type declarations)

## Exported Types

- `SamplePipe` — interface for pipe stages
- `PlayEventDetail` — event detail for PitchShifter `play` events
- `SourcePositionCallback` — callback signature for position tracking

## Rules

- No runtime dependencies — this library ships standalone
- All public API must be exported from `index.ts`
- New exported types must use `export type` in `index.ts`
- Samples are interleaved stereo (`[L, R, L, R, ...]`) throughout the pipeline
- Buffer sizes are in sample frames (2 floats per frame for stereo)
