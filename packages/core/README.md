# @soundtouchjs/core

Core audio processing library for real-time pitch shifting using the Web Audio API. A TypeScript rewrite of the [SoundTouch](https://www.surina.net/soundtouch/) audio processing library.

[I accept cash](https://paypal.me/cutterbl?locale.x=en_US) if you like what's been done.

Part of the [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) monorepo — for more information and so much more.

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

- `lanczos`: `zeroCrossings` (default `4`, normalized to `2..8`), `normalize` (default `false`)
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
| `AbstractSamplePipe`                  | Base class for pipeline stages that read from an input buffer and write to an output buffer |
| `CircularSampleBuffer`                | Circular interleaved sample buffer (default processing path)             |
| `FifoSampleBuffer`                    | Resizable interleaved sample buffer (ES2024 `ArrayBuffer`)               |
| `Stretch`                             | WSOLA time-stretch stage (used internally by `SoundTouch`)               |
| `RateTransposer`                      | Sample rate transposer (used internally by `SoundTouch`)                 |
| `registerInterpolationStrategy`       | Registers a custom interpolation strategy plugin                         |
| `unregisterInterpolationStrategy`     | Removes a previously registered plugin strategy                          |
| `hasInterpolationStrategy`            | Returns `true` if a strategy id is currently registered                  |
| `listInterpolationStrategies`         | Returns all registered strategy ids sorted lexicographically             |
| `getActiveInterpolationStrategyId`    | Returns the current process-wide default strategy id                     |
| `setActiveInterpolationStrategy`      | Changes process-wide default interpolation strategy id                   |
| `normalizeInterpolationStrategyId`    | Validates and resolves a strategy option to a registered id              |
| `resolveInterpolationStrategy`        | Resolves a strategy option to a built-in base id or plugin kernel        |
| `resolveInterpolationStrategyRuntime` | Resolves runtime kernel + normalized params + applier hook               |
| `StretchParameters`                   | Type for WSOLA timing parameters passed to `setStretchParameters`        |
| `StretchPipe`                         | Interface for a WSOLA-compatible stretch stage (implement to replace it) |
| `StretchFactory`                      | Factory function type for creating a custom `StretchPipe`                |
| `StretchFactoryOptions`               | Options passed from `SoundTouch` to a `StretchFactory`                   |

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

#### Custom stretch stage via `stretchFactory`

`SoundTouchOptions.stretchFactory` lets you replace the built-in WSOLA `Stretch` stage with any `StretchPipe`-compatible implementation:

```ts
import { SoundTouch } from '@soundtouchjs/core';
import type { StretchFactory } from '@soundtouchjs/core';

const myFactory: StretchFactory = (sampleRate, opts) =>
  new MyCustomStretch(sampleRate, opts);

const st = new SoundTouch({ stretchFactory: myFactory });
```

The factory receives the sample rate and a `StretchFactoryOptions` object containing `sampleBufferFactory` and `sampleBufferType`. `SoundTouch` calls `setParameters` on the returned instance after construction.

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

## What's changed

Notable additions and changes since the v0.4 rewrite:

- **`StretchPipe` interface**: `SoundTouch` accepts a `stretchFactory` option to replace the built-in WSOLA `Stretch` stage with a custom implementation (e.g. phase vocoder).
- **WSOLA timing parameters**: `setStretchParameters()` exposes `sequenceMs`, `seekWindowMs`, `overlapMs`, and `quickSeek` for tuning the time-stretch algorithm at runtime.
- **Simplified public API**: `rate`, `tempo`, `virtualRate`, and `virtualTempo` removed from `SoundTouch`. Pitch is the only public control; playback speed is handled at the source node level.
- **Interpolation strategy IDs standardised**: IDs renamed (`lanczos8` → `lanczos`, `hann8` → `hann`, `blackman8` → `blackman`, `kaiser8` → `kaiser`) and all strategy params unified around `zeroCrossings`.
- **Licensing**: Moved from LGPL to MPL-2.0.

### v0.4 (initial rewrite)

- **Monorepo**: Now published as `@soundtouchjs/core` from an [Nx](https://nx.dev) monorepo (was `soundtouchjs`)
- **TypeScript**: Full rewrite — strict mode, zero `any`, complete type exports
- **ESM only**: Pure ES modules targeting ES2024 (`import`/`export`, no CommonJS)
- **ES2024 buffers**: `FifoSampleBuffer` uses resizable `ArrayBuffer` for zero-allocation growth
- **Interpolation plugin architecture**: strategy registry with `lanczos` default and pluggable strategies
- **Optimized internals**: Dirty-flag overlap buffers in `Stretch`
- **Zero runtime dependencies**

### Breaking changes

If you are upgrading from an earlier version of `@soundtouchjs/core`:

- **Removed exports**: `AbstractFifoSamplePipe` (replaced by `AbstractSamplePipe`), `FilterSupport`, `SimpleFilter`, `WebAudioBufferSource`, `PitchShifter`, `getWebAudioNode`
- **Removed types**: `SamplePipe`, `PlayEventDetail`, `SourcePositionCallback`
- **Constructor change**: `SoundTouch` now requires a named options object — `new SoundTouch({ sampleRate, sampleBufferType })` (was `new SoundTouch()`)
- **Strategy ID rename**: `lanczos8` → `lanczos`, `hann8` → `hann`, `blackman8` → `blackman`, `kaiser8` → `kaiser`

## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.
