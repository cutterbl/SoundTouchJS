# @soundtouchjs/core

Core audio processing library for real-time pitch shifting using the Web Audio API. A TypeScript rewrite of the [SoundTouch](https://www.surina.net/soundtouch/) audio processing library.

## Installation

```sh
npm install @soundtouchjs/core
```

## API docs

Detailed developer documentation for all public class and function exports is available in Storybook: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/core-soundtouch--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/core-soundtouch--docs).

## Usage

> For real-time browser audio, use [`@soundtouchjs/audio-worklet`](../audio-worklet/README.md) instead. `@soundtouchjs/core` is for building custom pipelines, offline processing, or integrating into non-browser environments.

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

st.setInterpolationStrategy('linear');

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

### Low-level API

For custom pipeline work, all internal components are exported:

```ts
import {
  CircularSampleBuffer,
  SoundTouch,
  FifoSampleBuffer,
  registerInterpolationStrategy,
  setActiveInterpolationStrategy,
} from '@soundtouchjs/core';

const st = new SoundTouch({});
st.pitch = 1.5;

// Optional FIFO buffer override
const stFifo = new SoundTouch({
  sampleRate: 44100,
  sampleBufferType: 'fifo',
});

// Feed samples manually and pull processed output
const inputSamples = new Float32Array(4096 * 2); // interleaved stereo
st.inputBuffer.putSamples(inputSamples);
st.process();

const outputBuffer = new Float32Array(4096 * 2);
st.outputBuffer.extract(outputBuffer, 0, 4096);
```

#### Key exports

| Export                                | Description                                                              |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `SoundTouch`                          | Main processing engine — set `pitch` or `pitchSemitones`                 |
| `CircularSampleBuffer`                | Circular interleaved sample buffer (default processing path)             |
| `FifoSampleBuffer`                    | Resizable interleaved sample buffer (ES2024 `ArrayBuffer`)               |
| `Stretch`                             | Time-stretch processor (used internally by `SoundTouch`)                 |
| `RateTransposer`                      | Sample rate transposer (used internally by `SoundTouch`)                 |
| `registerInterpolationStrategy`       | Registers a custom interpolation strategy id (or kernel)                 |
| `resolveInterpolationStrategyRuntime` | Resolves runtime kernel + normalized params for an option                |
| `setActiveInterpolationStrategy`      | Changes process-wide default interpolation strategy id                   |
| `StretchParameters`                   | Type for WSOLA timing parameters passed to `setStretchParameters`        |

#### WSOLA timing parameters

`SoundTouch` exposes `setStretchParameters()` to tune the time-stretch algorithm at runtime:

```ts
const st = new SoundTouch({});

st.setStretchParameters({ overlapMs: 12 });             // crossfade overlap only
st.setStretchParameters({ quickSeek: false });          // exhaustive correlation search
st.setStretchParameters({ sequenceMs: 80, seekWindowMs: 20 }); // manual windows
st.setStretchParameters({ sequenceMs: 0 });             // back to auto
```

| Param | Default | Description |
|-------|---------|-------------|
| `sequenceMs` | auto (50–125 ms) | Processing window length; `0` = auto-calculate from tempo |
| `seekWindowMs` | auto (15–25 ms) | Seek window length; `0` = auto-calculate |
| `overlapMs` | 8 ms | Crossfade overlap length |
| `quickSeek` | `true` | Fast multi-pass seek; `false` = exhaustive (better quality, slower) |

`Stretch` also exposes individual `overlapMs` (getter/setter) and `quickSeek` (getter/setter) properties.

## Constructor API (breaking)

`@soundtouchjs/core` constructors now use named options objects instead of positional arguments.

Example:

```ts
new SoundTouch({ sampleRate: 44100, sampleBufferType: 'fifo' });
```

## Key switching and pitch control

Changing the musical key of playback is handled by the `pitchSemitones` parameter. Each integer step corresponds to one semitone (half-step) on the chromatic scale. For example:

- `pitchSemitones = 2` shifts the key up a whole step
- `pitchSemitones = -3` shifts down a minor third

The effective pitch multiplier is calculated as:

    pitch * 2^(pitchSemitones / 12)

This lets you combine continuous pitch control (`pitch`) with discrete key changes (`pitchSemitones`).

For most musical applications, set `pitchSemitones` to the desired interval and leave `pitch` at `1.0` unless you want fine-tuning within a semitone.

See [`@soundtouchjs/audio-worklet`](../audio-worklet/README.md) for AudioWorklet-based usage.

## What's changed in v0.4

- **Monorepo**: Now published as `@soundtouchjs/core` from an [Nx](https://nx.dev) monorepo (was `soundtouchjs`)
- **TypeScript**: Full rewrite — strict mode, zero `any`, complete type exports
- **ESM only**: Pure ES modules targeting ES2024 (`import`/`export`, no CommonJS)
- **ES2024 buffers**: `FifoSampleBuffer` uses resizable `ArrayBuffer` for zero-allocation growth
- **Interpolation plugin architecture**: strategy registry with `lanczos` default and pluggable strategies
- **Optimized internals**: Dirty-flag overlap buffers in `Stretch`
- **Zero runtime dependencies**

## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.
