# @soundtouchjs/worklet-base

Abstract base class for SoundTouchJS AudioWorklet processor packages. Centralises the shared DSP pipeline, runtime-update queue, and sample-buffer management that would otherwise be duplicated across every processor implementation.

[I accept cash](https://paypal.me/cutterbl?locale.x=en_US) if you like what's been done.

Part of the [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) monorepo — for more information and so much more.

## Who this package is for

This package is an **implementation detail** of the SoundTouchJS worklet packages (`@soundtouchjs/audio-worklet`, `@soundtouchjs/phase-vocoder-worklet`, `@soundtouchjs/formant-correction-worklet`). It is also the correct starting point if you want to build a **custom AudioWorklet processor** on top of the SoundTouch engine.

If you only want to use SoundTouchJS in a web app, install one of the worklet packages above — you do not need to install this package directly.

## Installation

```sh
npm install @soundtouchjs/worklet-base
```

## Usage

Extend `SoundTouchProcessorBase` inside your processor module and implement the required `onProcessComplete` hook:

```ts
import { SoundTouchProcessorBase, STANDARD_PARAMETER_DESCRIPTORS } from '@soundtouchjs/worklet-base';
import type { ProcessCoreResult } from '@soundtouchjs/worklet-base';

class MyProcessor extends SoundTouchProcessorBase {
  static get parameterDescriptors() {
    return STANDARD_PARAMETER_DESCRIPTORS;
  }

  constructor() {
    super('[MyProcessor]', {});
  }

  onProcessComplete(result: ProcessCoreResult): void {
    // called after each block; post metrics, trigger side-effects, etc.
    this.port.postMessage({ type: 'metrics', ...result });
  }
}

registerProcessor('my-processor', MyProcessor);
```

### Optional hooks

| Method | When to override |
|---|---|
| `beforePipeProcess(left, right, frameCount, params)` | Pre-pipe analysis (e.g. LPC analysis for formant correction). Default is a no-op. |
| `extractSamples(leftOutput, rightOutput, frameCount)` | Full extraction/write-back override (e.g. formant synthesis). Default writes both channels and returns RMS/peak metrics. |

### Runtime messages

Send messages to the processor via `AudioWorkletNode.port.postMessage`:

```ts
// Change interpolation strategy
node.port.postMessage({ type: 'setInterpolationStrategy', value: 'lanczos' });

// Update strategy parameters
node.port.postMessage({ type: 'setInterpolationStrategyParams', value: { ... } });

// Update stretch parameters
node.port.postMessage({ type: 'setStretchParameters', value: { ... } });
```

## API

### `SoundTouchProcessorBase`

Abstract class extending `AudioWorkletProcessor`.

#### Constructor

```ts
new SoundTouchProcessorBase(processorLabel: string, pipeOptions: SoundTouchOptions)
```

| Parameter | Description |
|---|---|
| `processorLabel` | Label used in log messages (e.g. `'[MyProcessor]'`). |
| `pipeOptions` | Options forwarded to `SoundTouch` (interpolation strategy, stretch parameters, etc.). |

#### Abstract method

```ts
abstract onProcessComplete(result: ProcessCoreResult): void
```

Called at the end of every successfully processed block. `result` contains `{ outputRms, outputPeak }` unless `extractSamples` is overridden to return different values.

#### Static method

```ts
static resolveStrategy(
  id: RateTransposerInterpolationStrategy | undefined,
  label: string,
): RateTransposerInterpolationStrategy | undefined
```

Validates an interpolation strategy ID against the registry. Falls back to `'lanczos'` and logs a warning for unknown IDs.

### `STANDARD_PARAMETER_DESCRIPTORS`

Array of `AudioParamDescriptor` objects for the three standard k-rate parameters: `pitch`, `pitchSemitones`, and `playbackRate`. Spread this into your `parameterDescriptors` getter.

### Message types

| Export | Description |
|---|---|
| `SetInterpolationStrategyMessage` | `{ type: 'setInterpolationStrategy', value: RateTransposerInterpolationStrategy }` |
| `SetInterpolationStrategyParamsMessage` | `{ type: 'setInterpolationStrategyParams', value: InterpolationStrategyParams }` |
| `SetStretchParametersMessage` | `{ type: 'setStretchParameters', value: StretchParameters }` |
| `ProcessorMessage` | Union of the three message types above. |
| `ProcessCoreResult` | `{ outputRms: number, outputPeak: number }` |

## License

[MPL-2.0](./LICENSE)
