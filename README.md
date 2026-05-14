# SoundTouchJS

A real-time audio processing library for pitch shifting and playback speed control using the Web Audio API. Converted, expanded, and maintained by [Cutter](https://cutterscrossing.com/), based on the original [SoundTouch](https://www.surina.net/soundtouch/) C++ library by Olli Parviainen.

## Monorepo

This project is an [Nx](https://nx.dev) monorepo managed with [pnpm](https://pnpm.io/) workspaces. It publishes ten packages:

| Package                                                                                               | npm                                                         | Description                                                              |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`@soundtouchjs/core`](packages/core/README.md)                                                       | `npm install @soundtouchjs/core`                            | Core processing library — `SoundTouch`, buffers, and the interpolation registry |
| [`@soundtouchjs/audio-worklet`](packages/audio-worklet/README.md)                                     | `npm install @soundtouchjs/audio-worklet`                   | AudioWorklet implementation with `AudioParam`-based controls, offline rendering, and processor metrics |
| [`@soundtouchjs/stretch-phase-vocoder`](packages/stretch-phase-vocoder/README.md)                     | `npm install @soundtouchjs/stretch-phase-vocoder`           | Phase vocoder time-stretch algorithm — implements `StretchPipe`, usable standalone or as a `SoundTouch` stretch stage |
| [`@soundtouchjs/phase-vocoder-worklet`](packages/phase-vocoder-worklet/README.md)                     | `npm install @soundtouchjs/phase-vocoder-worklet`           | AudioWorklet implementation using the phase vocoder for smoother extreme-ratio time-stretching |
| [`@soundtouchjs/formant-correction-worklet`](packages/formant-correction-worklet/README.md)           | `npm install @soundtouchjs/formant-correction-worklet`      | AudioWorklet implementation with LPC-based formant preservation for natural-sounding vocal pitch shifts |
| [`@soundtouchjs/interpolation-strategy-lanczos`](packages/interpolation-strategy-lanczos/README.md)   | `npm install @soundtouchjs/interpolation-strategy-lanczos`  | Lanczos interpolation strategy plugin (default strategy id: `lanczos`)  |
| [`@soundtouchjs/interpolation-strategy-linear`](packages/interpolation-strategy-linear/README.md)     | `npm install @soundtouchjs/interpolation-strategy-linear`   | Linear interpolation strategy plugin (strategy id: `linear`)             |
| [`@soundtouchjs/interpolation-strategy-hann`](packages/interpolation-strategy-hann/README.md)         | `npm install @soundtouchjs/interpolation-strategy-hann`     | Hann interpolation strategy plugin (strategy id: `hann`)                |
| [`@soundtouchjs/interpolation-strategy-blackman`](packages/interpolation-strategy-blackman/README.md) | `npm install @soundtouchjs/interpolation-strategy-blackman` | Blackman interpolation strategy plugin (strategy id: `blackman`)        |
| [`@soundtouchjs/interpolation-strategy-kaiser`](packages/interpolation-strategy-kaiser/README.md)     | `npm install @soundtouchjs/interpolation-strategy-kaiser`   | Kaiser interpolation strategy plugin (strategy id: `kaiser`)            |

A development [demo app](apps/demo/) is included for testing both packages in a browser.

If you are new to Web Audio, start with the demo guide: [apps/demo/README.md](apps/demo/README.md).

## Documentation

- Storybook docs home: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/introduction--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/introduction--docs)
- Core package API and concepts: [packages/core/README.md](packages/core/README.md)
- Core API reference index: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/core-soundtouch--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/core-soundtouch--docs)
- AudioWorklet package API and setup: [packages/audio-worklet/README.md](packages/audio-worklet/README.md)
- AudioWorklet API reference index: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/audio-worklet-soundtouchnode--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/audio-worklet-soundtouchnode--docs)
- SoundTouchNode reference: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/audio-worklet-soundtouchnode--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/audio-worklet-soundtouchnode--docs)
- Interpolation strategy plugins: [packages/interpolation-strategy-lanczos/README.md](packages/interpolation-strategy-lanczos/README.md), [packages/interpolation-strategy-linear/README.md](packages/interpolation-strategy-linear/README.md), [packages/interpolation-strategy-hann/README.md](packages/interpolation-strategy-hann/README.md), [packages/interpolation-strategy-blackman/README.md](packages/interpolation-strategy-blackman/README.md), [packages/interpolation-strategy-kaiser/README.md](packages/interpolation-strategy-kaiser/README.md)
- Phase vocoder (time-stretch algorithm): [packages/stretch-phase-vocoder/README.md](packages/stretch-phase-vocoder/README.md)
- Phase vocoder AudioWorklet: [packages/phase-vocoder-worklet/README.md](packages/phase-vocoder-worklet/README.md)
- Formant correction AudioWorklet: [packages/formant-correction-worklet/README.md](packages/formant-correction-worklet/README.md)
- Beginner Web Audio + demo architecture guide: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/getting-started--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/getting-started--docs)

## Quick start

### AudioWorklet (recommended)

The `@soundtouchjs/audio-worklet` package runs processing on the audio rendering thread via `AudioWorkletProcessor`, replacing the deprecated `ScriptProcessorNode`.

```ts
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

const audioCtx = new AudioContext();
await SoundTouchNode.register(audioCtx, '/soundtouch-processor.js');

const stNode = new SoundTouchNode({ context: audioCtx });
stNode.connect(audioCtx.destination);

const source = audioCtx.createBufferSource();
source.buffer = audioBuffer;
source.connect(stNode);

// To change playback speed, set both source and stNode to the same value
source.playbackRate.value = 1.2;
stNode.playbackRate.value = 1.2;

stNode.pitch.value = 0.9;
source.start();
```

`SoundTouchNode` exposes three AudioParams: `pitch`, `pitchSemitones`, and `playbackRate`. Playback speed is controlled via `playbackRate` — see the [audio-worklet README](packages/audio-worklet/README.md) for how the mirror pattern works.

Interpolation defaults to `lanczos` (Lanczos kernel plugin) in both core and audio-worklet flows. You can opt into `linear` for A/B testing and latency/quality comparisons.

See each package's README for full API documentation.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10

### Setup

```sh
pnpm install
```

### Commands

```sh
pnpm build              # Build all projects
pnpm test               # Run all tests
pnpm coverage:summary   # Run package coverage and write consolidated report to .coverage-reports/
pnpm typecheck          # Typecheck all projects
pnpm dev                # Start demo dev server (Vite on port 8080)
pnpm prettier           # Format all files
pnpm nx storybook storybook  # Start Storybook docs server
```

Individual project commands via Nx:

```sh
pnpm nx build core           # Build @soundtouchjs/core
pnpm nx build audio-worklet  # Build @soundtouchjs/audio-worklet
pnpm nx build @soundtouchjs/interpolation-strategy-lanczos
pnpm nx build @soundtouchjs/interpolation-strategy-linear
pnpm nx build @soundtouchjs/interpolation-strategy-hann
pnpm nx build @soundtouchjs/interpolation-strategy-blackman
pnpm nx build @soundtouchjs/interpolation-strategy-kaiser
pnpm nx test core            # Run core tests
pnpm nx test audio-worklet   # Run audio-worklet tests
pnpm nx dev demo             # Dev server with HMR
```

### Running the demo

```sh
pnpm dev
```

Opens a browser at `http://localhost:8080` with sliders for pitch, key, playback speed, and volume. The demo uses `@soundtouchjs/audio-worklet` under the hood.

For a beginner-oriented walkthrough of the signal graph, playback modes, loop behavior, and parameter cause/effect, see [apps/demo/README.md](apps/demo/README.md).

Music: "Actionable" from [Bensound.com](http://bensound.com). This is a limited use license — refer to [their licensing](https://www.bensound.com/licensing) for details.

## Stage and Commit Instructions

When working in local development, the repository is configured with a Husky pre-commit hook. This hook ensures that tasks such as linting and typechecking are executed before the commit is finalized. As a result, when staging and committing changes, Copilot must wait for these tasks to complete and summarize their output.

### Steps:
1. Stage the changes using `git add <file>`.
2. Commit the changes using `git commit -m "<commit message>"`.
3. Wait for the pre-commit hook tasks to complete.
4. Summarize the output of the pre-commit hook tasks, including any errors or warnings encountered.

## What's changed

The latest release builds on the modernization of `v0.4` with significant new features, tooling updates, and expanded package offerings:

- **Storybook Enhancements**: Added live processor metrics display and new playgrounds for interpolation strategies, phase vocoder, and formant correction.
- **New Packages**:
  - `@soundtouchjs/formant-correction-worklet`: AudioWorklet with LPC-based formant preservation.
  - `@soundtouchjs/stretch-phase-vocoder`: Phase vocoder time-stretch algorithm.
  - Interpolation strategy plugins: `lanczos`, `linear`, `hann`, `blackman`, `kaiser`.
- **Offline Rendering**: Enhanced `processOffline()` in `@soundtouchjs/audio-worklet` for rendering `AudioBuffer` without a live audio device.
- **Processor Observability**: Expanded `SoundTouchNode.metrics` and `metrics` CustomEvent for detailed monitoring.
- **Tooling Updates**: Pre-commit hooks now include linting; added `pnpm coverage:summary` for consolidated coverage reports.
- **Licensing Update**: With significant rewrites, we have now moved off of the LGPL to the MPL-2.0 — see [LICENSE](LICENSE) for details.
- **Breaking Changes**: Removed deprecated APIs and types in `@soundtouchjs/core` and `@soundtouchjs/audio-worklet`. See the respective package READMEs for migration details.

### Breaking changes

If you are upgrading from an earlier version, the following APIs were removed:

**`@soundtouchjs/core`**
- Removed exports: `AbstractFifoSamplePipe` (replaced by `AbstractSamplePipe`), `FilterSupport`, `SimpleFilter`, `WebAudioBufferSource`, `PitchShifter`, `getWebAudioNode`
- Removed types: `SamplePipe`, `PlayEventDetail`, `SourcePositionCallback`
- `SoundTouch` constructor now takes a named options object: `new SoundTouch({ sampleRate, sampleBufferType, ... })` (was `new SoundTouch()`)
- Interpolation strategy IDs renamed: `lanczos8` → `lanczos`, `hann8` → `hann`, `blackman8` → `blackman`, `kaiser8` → `kaiser`

**`@soundtouchjs/audio-worklet`**
- `SoundTouchNode` constructor now takes a named options object with a required `context` property: `new SoundTouchNode({ context: audioCtx })` (was `new SoundTouchNode(audioCtx)`)
- `tempo` AudioParam removed — tempo is now controlled via the source node's `playbackRate` mirrored to `stNode.playbackRate` (see [audio-worklet README](packages/audio-worklet/README.md) for the pattern)

## Contributing

Fork the repo, work in a branch, submit a Pull Request. Commits follow [Conventional Commits](https://www.conventionalcommits.org/) with sentence-case subjects.

For pull requests, CI also runs `pnpm coverage:summary`, gates on its result, and publishes `.coverage-reports/summary.md` in the PR Checks job summary.

## In case you are interested

The original SoundTouch library was written in C++ by Olli Parviainen. It was first ported to JavaScript by Ryan Berdeen, then further adapted by Jakub Fiala, Adrian Holovaty, and others. This project was converted to ES2015+ and has been expanded and maintained by Steve 'Cutter' Blades.

## License

MPL-2.0 — see [LICENSE](LICENSE) for details.

[I accept cash](https://paypal.me/cutterbl?locale.x=en_US) if you like what's been done.

## Contributors

- [Steve 'Cutter' Blades](https://cutterscrossing.com)
- [Olli Parviainen](https://www.surina.net/soundtouch/)
- [Ryan Berdeen](http://ryanberdeen.com)
- [Jakub Fiala](http://fiala.space)
- [Adrian Holovaty](http://www.holovaty.com)
