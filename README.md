# SoundTouchJS

A real-time audio processing library for pitch shifting, tempo adjustment, and rate transposition using the Web Audio API. Converted, expanded, and maintained by [Cutter](https://cutterscrossing.com/), based on the original [SoundTouch](https://www.surina.net/soundtouch/) C++ library by Olli Parviainen.

## Monorepo

This project is an [Nx](https://nx.dev) monorepo managed with [pnpm](https://pnpm.io/) workspaces. It publishes four packages:

| Package                                                                                      | npm                                                 | Description                                                              |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| [`@soundtouchjs/core`](packages/core/README.md)                                              | `npm install @soundtouchjs/core`                    | Core processing library — `SoundTouch`, `PitchShifter`, buffers, filters |
| [`@soundtouchjs/audio-worklet`](packages/audio-worklet/README.md)                            | `npm install @soundtouchjs/audio-worklet`           | AudioWorklet implementation with `AudioParam`-based controls             |
| [`@cxing/interpolation-strategy-lanczos`](packages/interpolation-strategy-lanczos/README.md) | `npm install @cxing/interpolation-strategy-lanczos` | Lanczos interpolation strategy plugin (default strategy id: `lanczos8`)  |
| [`@cxing/interpolation-strategy-linear`](packages/interpolation-strategy-linear/README.md)   | `npm install @cxing/interpolation-strategy-linear`  | Linear interpolation strategy plugin (strategy id: `linear`)             |

A development [demo app](apps/demo/) is included for testing both packages in a browser.

If you are new to Web Audio, start with the demo guide: [apps/demo/README.md](apps/demo/README.md).

## Documentation

- Core package API and concepts: [packages/core/README.md](packages/core/README.md)
- Core API reference index: [packages/core/docs/README.md](packages/core/docs/README.md)
- AudioWorklet package API and setup: [packages/audio-worklet/README.md](packages/audio-worklet/README.md)
- AudioWorklet API reference index: [packages/audio-worklet/docs/README.md](packages/audio-worklet/docs/README.md)
- SoundTouchNode reference: [packages/audio-worklet/docs/sound-touch-node.md](packages/audio-worklet/docs/sound-touch-node.md)
- Interpolation strategy plugins: [packages/interpolation-strategy-lanczos/README.md](packages/interpolation-strategy-lanczos/README.md), [packages/interpolation-strategy-linear/README.md](packages/interpolation-strategy-linear/README.md)
- Beginner Web Audio + demo architecture guide: [apps/demo/README.md](apps/demo/README.md)

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

stNode.tempo.value = 1.2;
stNode.pitch.value = 0.9;
source.start();
```

The audio-worklet package exposes wider real-time control ranges for `pitch`, `tempo`, `rate`, and `playbackRate` than earlier releases. Those controls are intentionally capped to balance flexibility with predictable real-time behavior: more extreme values can increase artifacts, reduce output quality, and make buffer behavior less stable on small AudioWorklet render blocks.

Interpolation defaults to `lanczos8` (Lanczos kernel plugin) in both core and audio-worklet flows. You can opt into `linear` for A/B testing and latency/quality comparisons.

### PitchShifter (ScriptProcessorNode)

The `@soundtouchjs/core` package provides a higher-level `PitchShifter` class with built-in playback tracking. This uses `ScriptProcessorNode`, which is deprecated but widely supported.

```ts
import { PitchShifter } from '@soundtouchjs/core';

const audioCtx = new AudioContext();
const shifter = new PitchShifter({
  context: audioCtx,
  buffer: audioBuffer,
  bufferSize: 16384,
});
shifter.tempo = 1.2;
shifter.pitch = 0.9;

shifter.on('play', (detail) => {
  console.log(detail.formattedTimePlayed, detail.percentagePlayed);
});

shifter.connect(audioCtx.destination);
```

See each package's README for full API documentation.

### Constructor API change

As of the latest release line, constructor calls use named options objects instead of positional arguments. Example:

```ts
// before
// new SoundTouchNode(audioCtx)

// now
new SoundTouchNode({ context: audioCtx });
```

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
pnpm typecheck          # Typecheck all projects
pnpm dev                # Start demo dev server (Vite on port 8080)
pnpm prettier           # Format all files
```

Individual project commands via Nx:

```sh
pnpm nx build core           # Build @soundtouchjs/core
pnpm nx build audio-worklet  # Build @soundtouchjs/audio-worklet
pnpm nx build @cxing/interpolation-strategy-lanczos
pnpm nx build @cxing/interpolation-strategy-linear
pnpm nx test core            # Run core tests
pnpm nx test audio-worklet   # Run audio-worklet tests
pnpm nx dev demo             # Dev server with HMR
```

### Running the demo

```sh
pnpm dev
```

Opens a browser at `http://localhost:8080` with sliders for tempo, pitch, key, and volume. The demo uses `@soundtouchjs/audio-worklet` under the hood.

For a beginner-oriented walkthrough of the signal graph, playback modes, loop behavior, and parameter cause/effect, see [apps/demo/README.md](apps/demo/README.md).

Music: "Actionable" from [Bensound.com](http://bensound.com). This is a limited use license — refer to [their licensing](https://www.bensound.com/licensing) for details.

## What's changed

The `v0.4` release is a ground-up modernization:

- **Monorepo**: Migrated from a single-package repo (`soundtouchjs`) to an Nx monorepo with scoped packages (`@soundtouchjs/core`, `@soundtouchjs/audio-worklet`)
- **TypeScript**: Full rewrite — strict mode, no `any`, complete type exports
- **ESM only**: Pure ES modules targeting ES2024 (no CommonJS)
- **AudioWorklet**: New `@soundtouchjs/audio-worklet` package replaces the [separate AudioWorklet repo](https://github.com/cutterbl/soundtouchjs-audio-worklet)
- **Interpolation plugin model**: Strategy registry with plugin packages; `lanczos8` as default, `linear` as optional override
- **ES2024 optimizations**: Resizable `ArrayBuffer` in `FifoSampleBuffer`, scratch buffer reuse, dirty-flag overlap buffers
- **pnpm workspaces**: Workspace protocol (`workspace:*`) for inter-package dependencies
- **Tooling**: Vite dev server, Vitest test runner, Prettier formatting, commitlint + husky, GitHub Actions CI, `nx release` for versioning and publishing
- **Zero runtime dependencies** on `@soundtouchjs/core`

## Contributing

Fork the repo, work in a branch, submit a Pull Request. Commits follow [Conventional Commits](https://www.conventionalcommits.org/) with sentence-case subjects.

## In case you are interested

The original SoundTouch library was written in C++ by Olli Parviainen. It was first ported to JavaScript by Ryan Berdeen, then further adapted by Jakub Fiala, Adrian Holovaty, and others. This project was converted to ES2015+ and has been expanded and maintained by Steve 'Cutter' Blades.

## License

LGPL-3.0 — see [LICENSE](LICENSE) for details.

[I accept cash](https://paypal.me/cutterbl?locale.x=en_US) if you like what's been done.

## Contributors

- [Steve 'Cutter' Blades](https://cutterscrossing.com)
- [Olli Parviainen](https://www.surina.net/soundtouch/)
- [Ryan Berdeen](http://ryanberdeen.com)
- [Jakub Fiala](http://fiala.space)
- [Adrian Holovaty](http://www.holovaty.com)
