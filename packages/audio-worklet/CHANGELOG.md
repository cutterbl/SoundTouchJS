## 1.0.0 (2026-03-09)

- Manually bump to 1.0.0 to rectify versioning after 0.4.0 release with breaking changes. No code changes from 0.4.0.

## 0.4.0 (2026-03-09)

### 🚀 Features

- ⚠️ Migrate to Nx monorepo, refactor to TypeScript, and add audio-worklet integration ([#37](https://github.com/cutterbl/SoundTouchJS/pull/37))

### ⚠️ Breaking Changes

- Migrate to Nx monorepo, refactor to TypeScript, and add audio-worklet integration ([#37](https://github.com/cutterbl/SoundTouchJS/pull/37))
  This refactors SoundtouchJS to Typescript, exporting
  the same bits and necessary types. This also changes
  the package name to `@soundtouchjs/core`.
  - test: Provide unit testing
  - feat: Buffer allocation improvements
  - feat: Add @soundtouchjs/audio-worklet package and update demo to AudioWorklet
  * Add @soundtouchjs/audio-worklet package with SoundTouchNode and bundled processor
  * AudioParam-based parameter control (pitch, tempo, rate, pitchSemitones)
  * Pre-bundled processor file with @soundtouchjs/core inlined (~23 KB)
  * Update demo app with dual-mode support (AudioBuffer and Audio Element)
  * Add README files for both published packages
  * Update root README for monorepo structure
