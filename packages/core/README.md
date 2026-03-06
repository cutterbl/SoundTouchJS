# @soundtouchjs/core

Core audio processing library for real-time pitch shifting, tempo adjustment, and rate transposition using the Web Audio API. A TypeScript rewrite of the [SoundTouch](https://www.surina.net/soundtouch/) audio processing library.

## Installation

```sh
npm install @soundtouchjs/core
```

## Usage

### PitchShifter (ScriptProcessorNode)

The simplest way to get started. `PitchShifter` wraps a `ScriptProcessorNode` and handles buffering, playback tracking, and parameter control.

```ts
import { PitchShifter } from '@soundtouchjs/core';

const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);

const response = await fetch('/audio.mp3');
const buffer = await response.arrayBuffer();
const audioBuffer = await audioCtx.decodeAudioData(buffer);

const shifter = new PitchShifter(audioCtx, audioBuffer, 16384);
shifter.tempo = 1.2;
shifter.pitch = 0.9;
shifter.pitchSemitones = -2;

shifter.on('play', (detail) => {
  console.log(detail.formattedTimePlayed); // "1:23"
  console.log(detail.percentagePlayed); // 42.5
});

// Connect to start playback
shifter.connect(gainNode);

// Disconnect to pause
shifter.disconnect();
```

> **Note:** `ScriptProcessorNode` is deprecated in the Web Audio spec. For new projects, consider using [`@soundtouchjs/audio-worklet`](../audio-worklet/README.md) which provides an `AudioWorklet`-based implementation.

### Low-level API

All internal components are exported for advanced use cases:

```ts
import {
  SoundTouch,
  SimpleFilter,
  WebAudioBufferSource,
  FifoSampleBuffer,
} from '@soundtouchjs/core';

const st = new SoundTouch();
st.pitch = 1.5;
st.tempo = 0.8;

const source = new WebAudioBufferSource(audioBuffer);
const filter = new SimpleFilter(source, st);

// Pull processed samples
const outputBuffer = new Float32Array(4096);
const framesRead = filter.extract(outputBuffer, 2048);
```

#### Key classes

| Export                 | Description                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| `SoundTouch`           | Main processing engine — set `pitch`, `tempo`, `rate`, or `pitchSemitones` |
| `PitchShifter`         | High-level wrapper using `ScriptProcessorNode` with playback events        |
| `SimpleFilter`         | Pulls samples through a `SoundTouch` pipe from a source                    |
| `WebAudioBufferSource` | Adapter from `AudioBuffer` to the internal sample source interface         |
| `FifoSampleBuffer`     | Resizable interleaved sample buffer (ES2024 `ArrayBuffer`)                 |
| `getWebAudioNode`      | Creates a `ScriptProcessorNode` wired to a `SimpleFilter`                  |
| `Stretch`              | Time-stretch processor (used internally by `SoundTouch`)                   |
| `RateTransposer`       | Sample rate transposer (used internally by `SoundTouch`)                   |

## What's changed in v0.4

- **Monorepo**: Now published as `@soundtouchjs/core` from an [Nx](https://nx.dev) monorepo (was `soundtouchjs`)
- **TypeScript**: Full rewrite — strict mode, zero `any`, complete type exports
- **ESM only**: Pure ES modules targeting ES2024 (`import`/`export`, no CommonJS)
- **ES2024 buffers**: `FifoSampleBuffer` uses resizable `ArrayBuffer` for zero-allocation growth
- **Optimized internals**: Scratch buffer reuse in `SimpleFilter`, dirty-flag overlap buffers in `Stretch`
- **Zero runtime dependencies**

## License

LGPL-2.1 — see [LICENSE](../../LICENSE) for details.
