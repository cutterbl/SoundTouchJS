# @soundtouchjs/audio-worklet

An [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) implementation of the SoundTouchJS audio processing library. Provides real-time pitch shifting, tempo adjustment, and rate transposition on the audio rendering thread — replacing the deprecated `ScriptProcessorNode` approach.

## Installation

```sh
npm install @soundtouchjs/audio-worklet
```

This package depends on [`@soundtouchjs/core`](../core/README.md), which will be installed automatically.

## Usage

### 1. Register the processor

The package ships a pre-bundled processor file at `@soundtouchjs/audio-worklet/processor`. You need to serve this file and register it with the `AudioContext` before creating a node.

```ts
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

const audioCtx = new AudioContext();

// Register the worklet processor (do this once)
await SoundTouchNode.register(audioCtx, '/soundtouch-processor.js');
```

How you serve the processor file depends on your setup:

- **Vite**: Copy or serve `node_modules/@soundtouchjs/audio-worklet/dist/soundtouch-processor.js` from your `public/` directory
- **Webpack**: Use `new URL('@soundtouchjs/audio-worklet/processor', import.meta.url)` with asset modules
- **Static hosting**: Copy the file to your static assets directory

### 2. Create a node and connect it

`SoundTouchNode` works with any Web Audio source node. The recommended approach for tempo control is to drive playback speed via the source's `playbackRate` and set the matching value on `stNode.playbackRate` — the processor automatically compensates pitch so you never need to calculate the ratio yourself.

#### With AudioBufferSourceNode

```ts
const stNode = new SoundTouchNode(audioCtx);
stNode.connect(audioCtx.destination);

const source = audioCtx.createBufferSource();
source.buffer = audioBuffer;
source.playbackRate.value = tempo; // tempo via playback rate
source.connect(stNode);

stNode.playbackRate.value = tempo; // tell processor the source rate
stNode.pitch.value = pitch; // desired pitch (auto-compensated)
source.start();
```

#### With an HTML audio element

```ts
const audioEl = document.querySelector('audio')!;
const stNode = new SoundTouchNode(audioCtx);
stNode.connect(audioCtx.destination);

const source = audioCtx.createMediaElementSource(audioEl);
source.connect(stNode);

audioEl.preservesPitch = false; // let SoundTouch handle pitch, not the browser
audioEl.playbackRate = tempo; // tempo via element playback rate
stNode.playbackRate.value = tempo; // tell processor the source rate
stNode.pitch.value = pitch; // desired pitch (auto-compensated)
```

> **Why `playbackRate` for tempo?** SoundTouch's internal time-stretcher operates on small 128-sample blocks in the AudioWorklet. At higher tempos, it can't produce enough output samples per block, causing audible gaps. Using the source's `playbackRate` feeds samples faster, keeping the processing pipe balanced. SoundTouch then only needs to correct pitch, which it handles cleanly.
>
> When using an `<audio>` element, set `preservesPitch = false` so the browser doesn't apply its own pitch correction on top of SoundTouch's.

### 3. Control parameters

All parameters are exposed as [`AudioParam`](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam) objects, supporting both direct value setting and automation.

```ts
// Direct value
stNode.pitch.value = 1.2;
stNode.tempo.value = 0.8;
stNode.rate.value = 1.0;
stNode.pitchSemitones.value = -3;

// Automation
stNode.pitch.linearRampToValueAtTime(2.0, audioCtx.currentTime + 5);
```

| Parameter        | Default | Range      | Description                                        |
| ---------------- | ------- | ---------- | -------------------------------------------------- |
| `pitch`          | 1.0     | 0.25 – 4.0 | Pitch multiplier (1.0 = original)                  |
| `tempo`          | 1.0     | 0.25 – 4.0 | Tempo multiplier (1.0 = original)                  |
| `rate`           | 1.0     | 0.25 – 4.0 | Playback rate (affects both pitch and tempo)       |
| `pitchSemitones` | 0       | -24 – 24   | Pitch shift in semitones (combined with `pitch`)   |
| `playbackRate`   | 1.0     | 0.25 – 4.0 | Source playback rate (for auto pitch compensation) |

### Full example — AudioBuffer

```ts
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);

await SoundTouchNode.register(audioCtx, '/soundtouch-processor.js');
const stNode = new SoundTouchNode(audioCtx);
stNode.connect(gainNode);

const response = await fetch('/audio.mp3');
const buffer = await response.arrayBuffer();
const audioBuffer = await audioCtx.decodeAudioData(buffer);

const source = audioCtx.createBufferSource();
source.buffer = audioBuffer;
source.playbackRate.value = 1.2; // 1.2x tempo
source.connect(stNode);

stNode.playbackRate.value = 1.2; // tell processor the source rate
stNode.pitch.value = 0.9; // desired pitch (auto-compensated)
stNode.pitchSemitones.value = -2;
gainNode.gain.value = 0.8;

source.start();
```

### Full example — Audio element

```ts
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

const audioEl = document.querySelector('audio')!;
const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);

await SoundTouchNode.register(audioCtx, '/soundtouch-processor.js');
const stNode = new SoundTouchNode(audioCtx);
stNode.connect(gainNode);

const source = audioCtx.createMediaElementSource(audioEl);
source.connect(stNode);

audioEl.preservesPitch = false;
audioEl.playbackRate = 1.2; // 1.2x tempo
stNode.playbackRate.value = 1.2; // tell processor the source rate
stNode.pitch.value = 0.9; // desired pitch (auto-compensated)
stNode.pitchSemitones.value = -2;
gainNode.gain.value = 0.8;
```

## Key switching and pitch control

Changing the musical key of playback is handled by the `pitchSemitones` parameter. Each integer step corresponds to one semitone (half-step) on the chromatic scale. For example:

- `stNode.pitchSemitones.value = 2` shifts the key up a whole step
- `stNode.pitchSemitones.value = -3` shifts down a minor third

The processor combines this with the `pitch` multiplier:

    effectivePitch = pitch * 2^(pitchSemitones / 12)

This lets you combine continuous pitch control (`pitch`) with discrete key changes (`pitchSemitones`).

For most musical applications, set `pitchSemitones` to the desired interval and leave `pitch` at 1.0 unless you want fine-tuning within a semitone.

## Package exports

| Export                                  | Description                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `@soundtouchjs/audio-worklet`           | Main-thread API: `SoundTouchNode` class, types                              |
| `@soundtouchjs/audio-worklet/processor` | Pre-bundled processor script (self-contained, `@soundtouchjs/core` inlined) |

## Architecture

- **Processor thread**: `SoundTouchProcessor` extends `AudioWorkletProcessor`, runs on the audio rendering thread. It interleaves stereo input, feeds it through the `SoundTouch` processing pipe, and deinterleaves the output. The `@soundtouchjs/core` library is bundled directly into the processor file so there are no import dependencies at runtime.
- **Main thread**: `SoundTouchNode` extends `AudioWorkletNode`, providing typed `AudioParam` accessors for pitch, tempo, rate, semitone shift, and playback rate. A static `register()` method handles `audioWorklet.addModule()`. When `playbackRate` is set, the processor automatically divides the desired pitch by the playback rate, so developers never need to manually compensate for rate-induced pitch shift.

## What's new in v0.4

- Complete rewrite in TypeScript (strict mode, full type exports)
- ESM only, targeting ES2024
- `AudioParam`-based parameter control (supports Web Audio automation)
- Pre-bundled processor file with `@soundtouchjs/core` inlined (~23 KB)
- NaN protection on audio output
- Stereo processing (mono input is duplicated to both channels)

## License

LGPL-2.1 — see [LICENSE](../../LICENSE) for details.
