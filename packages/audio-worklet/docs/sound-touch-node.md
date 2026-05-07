# SoundTouchNode

## Import

```ts
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
```

## Purpose

`SoundTouchNode` is the main-thread `AudioWorkletNode` wrapper for SoundTouch processing on the render thread.

It provides:

- Worklet module registration helpers.
- Constructor options for sample-buffer and interpolation strategy behavior.
- Typed `AudioParam` getters for runtime control.

## Constructor

```ts
new SoundTouchNode({
  context,
  processorUrl?,
  sampleBufferType?,
  interpolationStrategy?,
})
```

### Options

- `context`: `BaseAudioContext` (required)
- `processorUrl`: optional convenience field retained in options type (registration still done via `register`)
- `sampleBufferType`: `'circular' | 'fifo'` (defaults internally to package constant)
- `interpolationStrategy`: strategy id/descriptor understood by `@soundtouchjs/core`

## Static methods

### `register(context, processorUrl)`

```ts
await SoundTouchNode.register(audioCtx, '/soundtouch-processor.js');
```

Registers the main SoundTouch processor module using `audioWorklet.addModule(...)`. Call this before constructing nodes.

### `registerStrategyModule(context, strategyModuleUrl)`

```ts
await SoundTouchNode.registerStrategyModule(
  audioCtx,
  '/my-strategy.worklet.js',
);
```

Registers an additional worklet module intended to install interpolation strategies in the worklet global scope.

## AudioParam getters

- `pitch`: pitch multiplier (`1.0` = unchanged)
- `tempo`: tempo multiplier (`1.0` = unchanged)
- `rate`: rate multiplier (`1.0` = unchanged)
- `pitchSemitones`: semitone shift
- `playbackRate`: source playback rate hint used for pitch compensation logic

Example:

```ts
const stNode = new SoundTouchNode({ context: audioCtx });
stNode.pitch.value = 0.95;
stNode.tempo.value = 1.1;
stNode.pitchSemitones.value = -2;
```

## Typical flow

```ts
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

const audioCtx = new AudioContext();
await SoundTouchNode.register(audioCtx, '/soundtouch-processor.js');

const stNode = new SoundTouchNode({
  context: audioCtx,
  sampleBufferType: 'circular',
  interpolationStrategy: 'lanczos8',
});

source.connect(stNode);
stNode.connect(audioCtx.destination);
```

## Notes

- `SoundTouchNode.processorName` exposes the processor identifier used by constructor internals.
- `ScriptProcessorNode` users should prefer this class for modern Web Audio thread behavior.
