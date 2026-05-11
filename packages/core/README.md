# @soundtouchjs/core

Core audio processing library for real-time pitch shifting, tempo adjustment, and rate transposition using the Web Audio API. A TypeScript rewrite of the [SoundTouch](https://www.surina.net/soundtouch/) audio processing library.

## Installation

```sh
npm install @soundtouchjs/core
```

## API docs

Detailed developer documentation for all public class and function exports is available in Storybook: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/core-soundtouch--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/core-soundtouch--docs).

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

const shifter = new PitchShifter({
  context: audioCtx,
  buffer: audioBuffer,
  bufferSize: 16384,
});
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

By default, `SoundTouch` and `PitchShifter` use circular sample buffers internally. To override that and force FIFO buffers:

```ts
const shifter = new PitchShifter({
  context: audioCtx,
  buffer: audioBuffer,
  bufferSize: 16384,
  sampleBufferType: 'fifo',
});
```

### Interpolation strategy selection

`RateTransposer` now resolves interpolation through a strategy registry. The default strategy id is `lanczos`.

Strategy registration adds strategies to the registry, but no longer changes the process-wide active strategy automatically.

To opt into linear interpolation:

```ts
import { SoundTouch, registerInterpolationStrategy } from '@soundtouchjs/core';
import { registerLinearStrategy } from '@soundtouchjs/interpolation-strategy-linear';

registerLinearStrategy({ registerInterpolationStrategy });

const st = new SoundTouch({
  interpolationStrategy: 'linear',
});
```

To configure strategy params and update them at runtime:

```ts
const st = new SoundTouch({
  interpolationStrategy: {
    id: 'lanczos',
    params: { zeroCrossings: 4 },
  },
});

st.setInterpolationStrategy({
  id: 'linear',
  params: { edgeHoldFrames: 2 },
});

st.setInterpolationStrategyParams({ edgeHoldFrames: 4 });
```

Current mutable params:

- `lanczos`: `radius` (default `4`, normalized to `2..8`)
- `linear`: `edgeHoldFrames` (default `1`, normalized to `0..32`)

To use default Lanczos explicitly:

```ts
const st = new SoundTouch({
  interpolationStrategy: 'lanczos',
});
```

> **Note:** `ScriptProcessorNode` is deprecated in the Web Audio spec. For new projects, consider using [`@soundtouchjs/audio-worklet`](../audio-worklet/README.md) which provides an `AudioWorklet`-based implementation.

### Low-level API

All internal components are exported for advanced use cases:

```ts
import {
  CircularSampleBuffer,
  SoundTouch,
  SimpleFilter,
  WebAudioBufferSource,
  FifoSampleBuffer,
  registerInterpolationStrategy,
  setActiveInterpolationStrategy,
} from '@soundtouchjs/core';

const st = new SoundTouch({});
st.pitch = 1.5;
st.tempo = 0.8;

// Optional FIFO override
const stFifo = new SoundTouch({
  sampleRate: 44100,
  sampleBufferType: 'fifo',
});

const source = new WebAudioBufferSource(audioBuffer);
const filter = new SimpleFilter({ sourceSound: source, pipe: st });

// Pull processed samples
const outputBuffer = new Float32Array(4096);
const framesRead = filter.extract(outputBuffer, 2048);
```

#### Key classes

| Export                                | Description                                                                |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `SoundTouch`                          | Main processing engine — set `pitch`, `tempo`, `rate`, or `pitchSemitones` |
| `PitchShifter`                        | High-level wrapper using `ScriptProcessorNode` with playback events        |
| `SimpleFilter`                        | Pulls samples through a `SoundTouch` pipe from a source                    |
| `WebAudioBufferSource`                | Adapter from `AudioBuffer` to the internal sample source interface         |
| `CircularSampleBuffer`                | Circular interleaved sample buffer used by the default processing path     |
| `FifoSampleBuffer`                    | Resizable interleaved sample buffer (ES2024 `ArrayBuffer`)                 |
| `getWebAudioNode`                     | Creates a `ScriptProcessorNode` wired to a `SimpleFilter`                  |
| `Stretch`                             | Time-stretch processor (used internally by `SoundTouch`)                   |
| `RateTransposer`                      | Sample rate transposer (used internally by `SoundTouch`)                   |
| `registerInterpolationStrategy`       | Registers a custom interpolation strategy id (or kernel)                   |
| `resolveInterpolationStrategyRuntime` | Resolves runtime kernel + normalized params for an option                  |
| `setActiveInterpolationStrategy`      | Changes process-wide default interpolation strategy id                     |

## Constructor API (breaking)

`@soundtouchjs/core` constructors now use named options objects instead of positional arguments.

Examples:

```ts
new SoundTouch({ sampleRate: 44100, sampleBufferType: 'fifo' });

new PitchShifter({
  context: audioCtx,
  buffer: audioBuffer,
  bufferSize: 16384,
  sampleBufferType: 'fifo',
});

new SimpleFilter({ sourceSound: source, pipe: soundTouch });
```

## What's changed in v0.4

- **Monorepo**: Now published as `@soundtouchjs/core` from an [Nx](https://nx.dev) monorepo (was `soundtouchjs`)
- **TypeScript**: Full rewrite — strict mode, zero `any`, complete type exports
- **ESM only**: Pure ES modules targeting ES2024 (`import`/`export`, no CommonJS)
- **ES2024 buffers**: `FifoSampleBuffer` uses resizable `ArrayBuffer` for zero-allocation growth
- **Interpolation plugin architecture**: strategy registry with `lanczos` default and pluggable strategies
- **Optimized internals**: Scratch buffer reuse in `SimpleFilter`, dirty-flag overlap buffers in `Stretch`
- **Zero runtime dependencies**

## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.

## Key switching and pitch control

Changing the musical key of playback is handled by the `pitchSemitones` parameter. Each integer step corresponds to one semitone (half-step) on the chromatic scale. For example:

- `pitchSemitones = 2` shifts the key up a whole step
- `pitchSemitones = -3` shifts down a minor third

The effective pitch is calculated as:

    pitch * 2^(pitchSemitones / 12)

This lets you combine continuous pitch control (`pitch`) with discrete key changes (`pitchSemitones`).

For most musical applications, set `pitchSemitones` to the desired interval and leave `pitch` at 1.0 unless you want fine-tuning within a semitone.

See [`@soundtouchjs/audio-worklet`](../audio-worklet/README.md) for AudioWorklet-based usage.
