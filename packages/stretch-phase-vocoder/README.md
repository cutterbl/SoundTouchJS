# @soundtouchjs/stretch-phase-vocoder

A phase vocoder time-stretch stage for SoundTouchJS. Implements the `StretchPipe` interface from `@soundtouchjs/core`, making it a drop-in replacement for the built-in WSOLA `Stretch` stage.

[I accept cash](https://paypal.me/cutterbl?locale.x=en_US) if you like what's been done.

Part of the [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) monorepo — for more information and so much more.

## Installation

```sh
npm install @soundtouchjs/stretch-phase-vocoder
```

## What is a phase vocoder?

A phase vocoder is an FFT-based algorithm for high-quality time-stretching. Unlike the default WSOLA algorithm, which works by searching for good overlap points in the time domain, the phase vocoder operates in the frequency domain:

1. Applies a sliding Hann-windowed FFT to the input signal.
2. Tracks instantaneous frequency per bin using phase differences between consecutive frames.
3. Rescales the synthesis hop to produce more or fewer output samples per frame.
4. Reconstructs the signal with IFFT and overlap-add.

**Trade-offs vs WSOLA:**

| | WSOLA (default) | Phase vocoder |
|--|--|--|
| Quality at extreme ratios | Good at moderate ratios; artifacts at > 2× | Smooth at all ratios; may have "phasiness" |
| Transient preservation | Better (time-domain search) | Worse (frequency smearing) |
| Computational cost | Lower | Higher (FFT per frame) |
| Latency | Lower (`Ha` samples) | Inherently `fftSize` samples |

## Usage

### As a drop-in for SoundTouch

```ts
import { SoundTouch } from '@soundtouchjs/core';
import { createPhaseVocoderFactory } from '@soundtouchjs/stretch-phase-vocoder';

const st = new SoundTouch({
  stretchFactory: createPhaseVocoderFactory(),       // default: 2048 FFT, 4× overlap
});

st.pitch = 1.5; // pitch up 50 % — phase vocoder handles the time-stretch
```

With custom parameters:

```ts
const st = new SoundTouch({
  stretchFactory: createPhaseVocoderFactory(1024, 4), // 1024-sample FFT, 4× overlap
});
```

### Standalone

```ts
import { PhaseVocoder } from '@soundtouchjs/stretch-phase-vocoder';

const pv = new PhaseVocoder({ fftSize: 2048, overlapFactor: 4 });
pv.inputBuffer = myInputBuffer;
pv.outputBuffer = myOutputBuffer;
pv.tempo = 0.75; // stretch to 4/3 duration

// Call once per analysis hop:
while (myInputBuffer.frameCount >= pv.sampleReq) {
  pv.process();
}
```

### With the AudioWorklet integration

Use `@soundtouchjs/phase-vocoder-worklet` for browser real-time playback. That package wires the phase vocoder into an `AudioWorkletNode` with the same API as `SoundTouchNode`.

## API

### `PhaseVocoder`

Implements `StretchPipe` from `@soundtouchjs/core`.

| Member | Description |
|--------|-------------|
| `inputBuffer` | Source `SampleBuffer` (interleaved stereo, L/R/L/R) |
| `outputBuffer` | Destination `SampleBuffer` |
| `tempo` | Time-stretch factor — same convention as WSOLA Stretch. > 1 speeds up, < 1 slows down |
| `sampleReq` | Frames needed per `process()` call = `fftSize / overlapFactor` |
| `process()` | Consumes `sampleReq` frames, produces `round(sampleReq / tempo)` frames |
| `clear()` | Resets all internal state |
| `clearMidBuffer()` | Resets only the phase accumulators (use after a seek) |
| `setParameters()` | No-op — phase vocoder timing is set by `fftSize`/`overlapFactor` |
| `setStretchParameters()` | No-op — accepts WSOLA params for interface compatibility |
| `clone()` | Returns a new `PhaseVocoder` with the same config but empty state |

### `createPhaseVocoderFactory(fftSize?, overlapFactor?)`

Returns a `StretchFactory` for use with `SoundTouchOptions.stretchFactory`.

```ts
function createPhaseVocoderFactory(
  fftSize?: 512 | 1024 | 2048 | 4096,   // default: 2048
  overlapFactor?: 2 | 4 | 8,            // default: 4
): StretchFactory
```

### FFT primitives

This package also exports its internal FFT implementation for custom use:

```ts
import { fft, ifft, makeHannWindow } from '@soundtouchjs/stretch-phase-vocoder';
```

| Function | Description |
|----------|-------------|
| `fft(re, im)` | In-place radix-2 Cooley-Tukey FFT (power-of-2 sizes) |
| `ifft(re, im)` | In-place inverse FFT |
| `makeHannWindow(size)` | Symmetric Hann window of the given size |

## Parameters

| Option | Default | Description |
|--------|---------|-------------|
| `fftSize` | 2048 | FFT frame size — larger gives better frequency resolution but higher latency (`fftSize` samples) |
| `overlapFactor` | 4 | Overlap factor — `4` = 75 % overlap (good quality); `8` = 87.5 % overlap (smoother, 2× cost) |

## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.
