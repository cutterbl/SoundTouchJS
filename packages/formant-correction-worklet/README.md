# @soundtouchjs/formant-correction-worklet

An `AudioWorklet` integration that applies SoundTouch pitch-shifting with LPC-based formant preservation. Use `FormantCorrectionNode` instead of `SoundTouchNode` when you need to shift pitch without the "chipmunk" or "giant" effect on voices.

[I accept cash](https://paypal.me/cutterbl?locale.x=en_US) if you like what's been done.

Part of the [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) monorepo — for more information and so much more.

## Installation

```sh
npm install @soundtouchjs/formant-correction-worklet
```

## The problem this solves

When you pitch-shift a voice with standard SoundTouch, the **formants** (vocal resonances that make a voice sound like a specific person) shift along with the pitch. Shifting a voice up by a perfect fifth sounds like a chipmunk; shifting it down sounds like a giant.

This package uses **LPC (Linear Predictive Coding)** to separate the formant envelope from the pitch-bearing signal, pitch-shift the signal, and then re-apply the original formant envelope at the new pitch — preserving the natural timbre of the voice.

## How it works

For each render block:

1. SoundTouch processes the original input → pitch-shifted output.
2. LPC coefficients are computed from a 512-sample sliding window of the input signal (order 16, Hamming-windowed autocorrelation + Levinson-Durbin recursion).
3. The LPC analysis filter removes the shifted formants from the pitch-shifted output (spectrally whitens it).
4. The LPC synthesis filter re-applies the original input formant envelope.
5. The `formantStrength` AudioParam blends the corrected and uncorrected signals.

## Setup

### Resolving `processorUrl`

#### Vite

```ts
import processorUrl from '@soundtouchjs/formant-correction-worklet/processor?url';
```

#### webpack 5

```ts
const processorUrl = new URL(
  '@soundtouchjs/formant-correction-worklet/processor',
  import.meta.url,
).href;
```

#### Static / CDN

Copy `.dist/formant-correction-processor.js` to your public directory:

```ts
const processorUrl = '/formant-correction-processor.js';
```

## Usage

```ts
import { FormantCorrectionNode } from '@soundtouchjs/formant-correction-worklet';

const audioCtx = new AudioContext();
await FormantCorrectionNode.register(audioCtx, processorUrl);

const node = new FormantCorrectionNode({ context: audioCtx });

node.pitchSemitones.value = 7;   // shift up a perfect fifth
node.formantStrength.value = 1;  // keep original timbre (default)

node.connect(audioCtx.destination);
sourceNode.connect(node);
```

## Offline processing

Use `processOffline()` to render the formant-correction pipeline in an `OfflineAudioContext`:

```ts
import { processOffline } from '@soundtouchjs/formant-correction-worklet';

const processed = await processOffline({
  input: audioBuffer,
  processorUrl,
  pitchSemitones: 7,
  formantStrength: 1,
  playbackRate: 1.2,
});
```

### A/B comparison

```ts
// A: raw pitch shift (chipmunk)
node.formantStrength.value = 0;

// B: formant-corrected
node.formantStrength.value = 1;

// Blend (crossfade between the two)
node.formantStrength.value = 0.5;
```

## API

Top-level exports:

| Export | Description |
|--------|-------------|
| `FormantCorrectionNode` | Main-thread AudioWorkletNode wrapper |
| `PROCESSOR_NAME` | Processor registration id |
| `processOffline(options)` | Offline rendering helper using `FormantCorrectionNode` |
| `autocorrelate`, `levinsonDurbin`, `applyAnalysisFilter`, `applySynthesisFilter` | LPC primitives for custom processing |

### `FormantCorrectionNode`

Extends `AudioWorkletNode`. Provides the same API as `SoundTouchNode` plus a `formantStrength` AudioParam.

#### Static methods

| Method | Description |
|--------|-------------|
| `FormantCorrectionNode.register(context, processorUrl)` | Registers the processor module. Must be called before constructing nodes. |
| `FormantCorrectionNode.registerStrategyModule(context, moduleUrl)` | Loads an interpolation strategy plugin into worklet scope. |
| `FormantCorrectionNode.processorName` | The registered processor identifier string. |

#### Constructor options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `context` | `BaseAudioContext` | required | AudioContext or OfflineAudioContext |
| `outputChannelCount` | `1 \| 2` | `2` | Set to `1` for mono destinations |
| `sampleBufferType` | `'circular' \| 'fifo'` | `'circular'` | Internal buffer strategy |
| `interpolationStrategy` | `RateTransposerInterpolationStrategy` | `'lanczos'` | Rate-transposer kernel |

#### AudioParams

| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `pitch` | `1.0` | `0.1–8.0` | Pitch multiplier (k-rate) |
| `pitchSemitones` | `0` | `-24–24` | Semitone pitch shift (k-rate) |
| `playbackRate` | `1.0` | `0.1–8.0` | Match the source node's `playbackRate` for accurate pitch compensation (k-rate) |
| `formantStrength` | `1.0` | `0.0–1.0` | `0` = raw pitch shift; `1` = full formant correction (k-rate) |

#### Methods

| Method | Description |
|--------|-------------|
| `setInterpolationStrategy(strategy)` | Switches interpolation strategy at runtime. |
| `setInterpolationStrategyParams(params)` | Updates parameters for the active strategy. |
| `setStretchParameters(params)` | Applies WSOLA timing parameters. |

#### Processor observability

```ts
node.addEventListener('metrics', (e) => {
  const { framesBuffered, underrunCount } = (e as CustomEvent<ProcessorMetrics>).detail;
});
const m = node.metrics; // ProcessorMetrics | null
```

## LPC primitives

The package also exports its internal LPC functions for custom use:

```ts
import {
  autocorrelate,
  levinsonDurbin,
  applyAnalysisFilter,
  applySynthesisFilter,
  LPC_ORDER,
  LPC_WINDOW,
} from '@soundtouchjs/formant-correction-worklet';
```

| Function | Description |
|----------|-------------|
| `autocorrelate(frame, order)` | Hamming-windowed biased autocorrelation, returns `r[0..order]` |
| `levinsonDurbin(r, order)` | Levinson-Durbin recursion → LPC predictor coefficients |
| `applyAnalysisFilter(frame, a, zi)` | FIR whitening filter; removes formant coloring |
| `applySynthesisFilter(frame, a, zi)` | IIR coloring filter; restores formant coloring |

## Trade-offs vs `SoundTouchNode`

| | `SoundTouchNode` | `FormantCorrectionNode` |
|--|--|--|
| Formant shift with pitch | Yes (chipmunk/giant effect) | Corrected — original timbre preserved |
| Computation | Lower | Higher (LPC per render block) |
| Best use case | Instruments, music | Vocals, speech |
| `formantStrength = 0` mode | — | Identical to `SoundTouchNode` |

## Architecture

`FormantCorrectionProcessor` extends `SoundTouchProcessorBase` from `@soundtouchjs/worklet-base`, sharing the DSP pipeline, runtime-update queue, and `STANDARD_PARAMETER_DESCRIPTORS` with the other SoundTouchJS worklet packages. The formant correction logic lives in `beforePipeProcess` (LPC analysis) and `extractSamples` (analysis/synthesis filter application + `formantStrength` blend) — both hooks defined by the base class contract.

## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.
