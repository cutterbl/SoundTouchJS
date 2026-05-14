# @soundtouchjs/phase-vocoder-worklet

An `AudioWorklet` integration that uses the phase vocoder time-stretch algorithm from `@soundtouchjs/stretch-phase-vocoder`. Provides `PhaseVocoderNode` as a drop-in replacement for `SoundTouchNode` when smoother time-stretching at extreme ratios is required.

## Installation

```sh
npm install @soundtouchjs/phase-vocoder-worklet @soundtouchjs/stretch-phase-vocoder
```

## When to use this package

- Playback at extreme ratios (< 0.5× or > 2×) where the default WSOLA algorithm produces audible artifacts.
- Smooth slow-motion or fast-forward effects where "phasiness" is acceptable.
- You want the same `AudioWorkletNode` API as `SoundTouchNode` with a different internal stretch algorithm.

For moderate ratios (0.5–2×) the default `@soundtouchjs/audio-worklet` typically sounds better.

## Setup

### Resolving `processorUrl`

#### Vite

```ts
import processorUrl from '@soundtouchjs/phase-vocoder-worklet/processor?url';
```

#### webpack 5

```ts
const processorUrl = new URL(
  '@soundtouchjs/phase-vocoder-worklet/processor',
  import.meta.url,
).href;
```

#### Static / CDN

Copy `.dist/phase-vocoder-processor.js` to your public directory and reference it by path:

```ts
const processorUrl = '/phase-vocoder-processor.js';
```

## Usage

```ts
import { PhaseVocoderNode } from '@soundtouchjs/phase-vocoder-worklet';

const audioCtx = new AudioContext();
await PhaseVocoderNode.register(audioCtx, processorUrl);

const node = new PhaseVocoderNode({
  context: audioCtx,
  fftSize: 2048,      // optional, default 2048
  overlapFactor: 4,   // optional, default 4
});

node.pitch.value = 1.5;        // pitch up 50 %
node.pitchSemitones.value = 3; // or shift by semitones
node.playbackRate.value = 0.5; // slow down 2×

node.connect(audioCtx.destination);

// Connect your source:
sourceNode.connect(node);
```

## Offline processing

Use `processOffline()` when you want the same phase-vocoder pipeline in an `OfflineAudioContext` (no live audio device needed):

```ts
import { processOffline } from '@soundtouchjs/phase-vocoder-worklet';

const processed = await processOffline({
  input: audioBuffer,
  processorUrl,
  playbackRate: 0.5,
  pitchSemitones: 3,
  fftSize: 1024,
  overlapFactor: 8,
});
```

## API

Top-level exports:

| Export | Description |
|--------|-------------|
| `PhaseVocoderNode` | Main-thread AudioWorkletNode wrapper |
| `PROCESSOR_NAME` | Processor registration id |
| `processOffline(options)` | Offline rendering helper using `PhaseVocoderNode` |

### `PhaseVocoderNode`

Extends `AudioWorkletNode`. Same API as `SoundTouchNode` with additional `fftSize` / `overlapFactor` options.

#### Static methods

| Method | Description |
|--------|-------------|
| `PhaseVocoderNode.register(context, processorUrl)` | Registers the processor module. Must be called before constructing nodes. |
| `PhaseVocoderNode.registerStrategyModule(context, moduleUrl)` | Loads an interpolation strategy plugin into worklet scope. |
| `PhaseVocoderNode.processorName` | The registered processor identifier string. |

#### Constructor options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `context` | `BaseAudioContext` | required | AudioContext or OfflineAudioContext |
| `fftSize` | `512 \| 1024 \| 2048 \| 4096` | `2048` | FFT frame size — larger = better frequency resolution, higher latency |
| `overlapFactor` | `2 \| 4 \| 8` | `4` | Overlap factor — higher = smoother output, more computation |
| `outputChannelCount` | `1 \| 2` | `2` | Output channel count (set to `1` for mono destinations) |
| `sampleBufferType` | `'circular' \| 'fifo'` | `'circular'` | Internal buffer strategy |
| `interpolationStrategy` | `RateTransposerInterpolationStrategy` | `'lanczos'` | Initial rate-transposer interpolation strategy |

#### AudioParams

| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `pitch` | `1.0` | `0.1–8.0` | Pitch multiplier (k-rate) |
| `pitchSemitones` | `0` | `-24–24` | Pitch shift in semitones, combined with `pitch` (k-rate) |
| `playbackRate` | `1.0` | `0.1–8.0` | Playback rate multiplier — set this to match the source node's `playbackRate` (k-rate) |

#### Methods

| Method | Description |
|--------|-------------|
| `setInterpolationStrategy(strategy)` | Switches interpolation strategy at runtime. |
| `setInterpolationStrategyParams(params)` | Updates parameters for the active strategy. |
| `setStretchParameters(params)` | No-op for the phase vocoder (accepted for API parity with `SoundTouchNode`). |

#### Processor observability

The processor posts metrics every 100 render blocks. Access them via the `metrics` getter or the `metrics` CustomEvent:

```ts
// Getter
const m = node.metrics; // ProcessorMetrics | null

// Event
node.addEventListener('metrics', (e) => {
  const { framesBuffered, underrunCount, blockCount } = (e as CustomEvent<ProcessorMetrics>).detail;
  console.log('underruns:', underrunCount);
});
```

`ProcessorMetrics` shape:

| Field | Description |
|-------|-------------|
| `framesBuffered` | Output frames available at the last render block |
| `underrunCount` | Cumulative render blocks with fewer output frames than requested |
| `blockCount` | Total render blocks processed |
| `timestamp` | `performance.now()` when the metrics arrived on the main thread |

## Trade-offs vs `SoundTouchNode`

| | `SoundTouchNode` (WSOLA) | `PhaseVocoderNode` |
|--|--|--|
| Quality at extreme ratios | Artifacts above 2× | Smooth at all ratios |
| Transient preservation | Better (time-domain) | Worse (frequency smearing) |
| Computation | Lower | Higher (FFT per hop) |
| Startup latency | Lower | `fftSize` samples |
| Artifacts | Clicks / repeats | "Phasiness" / smearing |

## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.
