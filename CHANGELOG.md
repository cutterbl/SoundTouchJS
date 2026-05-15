## 2.0.2 (2026-05-15)

### Bug Fixes

- Release ([#72](https://github.com/cutterbl/SoundTouchJS/pull/72))
- Release ([#73](https://github.com/cutterbl/SoundTouchJS/pull/73))
- Release conventional commits ([#75](https://github.com/cutterbl/SoundTouchJS/pull/75))
- **ci:** Remove paths-ignore from storybook pages trigger, add workflow_dispatch ([#69](https://github.com/cutterbl/SoundTouchJS/pull/69))
- **ci:** Allow workflow_dispatch to bypass release commit check ([#70](https://github.com/cutterbl/SoundTouchJS/pull/70))
- **release:** Remove duplicate conventionalCommits from version config ([#74](https://github.com/cutterbl/SoundTouchJS/pull/74))
- **release:** Set releaseTagPattern to match existing v{version} git tags ([#76](https://github.com/cutterbl/SoundTouchJS/pull/76))

### ❤️ Thank You

- Steve 'Cutter' Blades

## 2.0.1 (2026-05-15)

### Bug Fixes

- Add publishConfig to interpolation strategy packages ([#66](https://github.com/cutterbl/SoundTouchJS/pull/66))
- **release:** Add repository field to interpolation strategy packages ([#68](https://github.com/cutterbl/SoundTouchJS/pull/68))

### ❤️ Thank You

- Steve 'Cutter' Blades

# 2.0.0 (2026-05-14)

### 🚀 Features

- Update README to reflect LGPL-3.0 license upgrade ([#64](https://github.com/cutterbl/SoundTouchJS/pull/64))
- Add Hann, Blackman, and Kaiser interpolation strategy packages ([58ccc34](https://github.com/cutterbl/SoundTouchJS/commit/58ccc34))
- ⚠️  Remove legacy ScriptProcessorNode API and simplify SoundTouch controls ([2047920](https://github.com/cutterbl/SoundTouchJS/commit/2047920))
- Refactor processing pipeline and update interpolation strategy integrations ([529a3e5](https://github.com/cutterbl/SoundTouchJS/commit/529a3e5))
- Add live processor metrics to Storybook playgrounds ([f41f2e8](https://github.com/cutterbl/SoundTouchJS/commit/f41f2e8))
- **audio-worklet:** Add processOffline() for OfflineAudioContext rendering ([a14eb10](https://github.com/cutterbl/SoundTouchJS/commit/a14eb10))
- **audio-worklet:** Add processor observability metrics ([ba7a767](https://github.com/cutterbl/SoundTouchJS/commit/ba7a767))
- **audio-worklet:** Add phase vocoder packages ([60d7277](https://github.com/cutterbl/SoundTouchJS/commit/60d7277))
- **audio-worklet:** Add formant correction worklet ([1d5b049](https://github.com/cutterbl/SoundTouchJS/commit/1d5b049))
- **core:** Add StretchPipe interface and stretchFactory option ([e3341fc](https://github.com/cutterbl/SoundTouchJS/commit/e3341fc))
- **core,audio-worklet:** Expose WSOLA timing parameters ([c8196a8](https://github.com/cutterbl/SoundTouchJS/commit/c8196a8))
- **storybook:** Add WSOLA stretch parameters and processOffline playgrounds ([fd6b73d](https://github.com/cutterbl/SoundTouchJS/commit/fd6b73d))
- **workspace:** Add Storybook docs and interpolation strategy packages ([bf9ebb6](https://github.com/cutterbl/SoundTouchJS/commit/bf9ebb6))

### 🩹 Fixes

- **storybook:** Align playground datalists with demo ([ab3b912](https://github.com/cutterbl/SoundTouchJS/commit/ab3b912))

### 💅 Refactors

- **core,docs:** Standardize interpolation strategy IDs and params\n\n- Rename all strategy IDs (hann8, blackman8, kaiser8, lanczos8) to (hann, blackman, kaiser, lanczos)\n- Standardize on zeroCrossings for kernel width param\n- Update all code, tests, and docs for new naming and parameter conventions\n- Remove deprecated lanczos8-strategy.mdx and update navigation\n- Add and update kitchen sink playgrounds for all strategies ([7c6ff25](https://github.com/cutterbl/SoundTouchJS/commit/7c6ff25))

### 📖 Documentation

- Update stage and commit instructions for Husky pre-commit hook ([d1d4701](https://github.com/cutterbl/SoundTouchJS/commit/d1d4701))
- Add Husky pre-commit hook instructions to repo-management ([20b816b](https://github.com/cutterbl/SoundTouchJS/commit/20b816b))
- **repo-management:** Update stage and commit instructions for Husky pre-commit hook ([533f7b5](https://github.com/cutterbl/SoundTouchJS/commit/533f7b5))
- **repo-management:** Update stage and commit instructions for Husky pre-commit hook ([6f28f52](https://github.com/cutterbl/SoundTouchJS/commit/6f28f52))
- **storybook:** Add Getting Started guide for processorModuleUrl resolution ([30f621a](https://github.com/cutterbl/SoundTouchJS/commit/30f621a))

### 🏡 Chore

- Commit current in-progress workspace state ([63bfd48](https://github.com/cutterbl/SoundTouchJS/commit/63bfd48))
- Remove package coverage artifacts and update Storybook links ([2fb4792](https://github.com/cutterbl/SoundTouchJS/commit/2fb4792))
- Align interpolation strategy params, tests, and Storybook docs ([3a803da](https://github.com/cutterbl/SoundTouchJS/commit/3a803da))
- Run lint in pre-commit hook ([880ef24](https://github.com/cutterbl/SoundTouchJS/commit/880ef24))
- **agents:** Nx agent config ([50417a2](https://github.com/cutterbl/SoundTouchJS/commit/50417a2))
- **docs:** Enrich CLAUDE.md with commands, architecture, and project conventions ([94d114b](https://github.com/cutterbl/SoundTouchJS/commit/94d114b))
- ⚠️  **license:** Upgrade LGPL text to version 3 ([#63](https://github.com/cutterbl/SoundTouchJS/pull/63))
- **storybook:** Reorder track and tempo controls in tempo story ([ac153e7](https://github.com/cutterbl/SoundTouchJS/commit/ac153e7))

### 🤖 CI

- Switch Storybook Pages deploy to GitHub Actions ([5f8021b](https://github.com/cutterbl/SoundTouchJS/commit/5f8021b))

### ⚠️  Breaking Changes

- Remove legacy ScriptProcessorNode API and simplify SoundTouch controls  ([2047920](https://github.com/cutterbl/SoundTouchJS/commit/2047920))
  PitchShifter, SimpleFilter, WebAudioBufferSource,
  getWebAudioNode, and FilterSupport are no longer exported from
  @soundtouchjs/core. SoundTouch no longer exposes rate, tempo, virtualRate,
  or virtualTempo. SoundTouchNode no longer exposes tempo or rate AudioParams.
  Remove PitchShifter, SimpleFilter, WebAudioBufferSource, getWebAudioNode,
  FilterSupport, minsSecs, and noop — all solely supported the deprecated
  ScriptProcessorNode path. AudioWorklet is supported in all targeted browsers
  including iOS Safari 14.5+.
  Simplify SoundTouch to pitch-only public control: remove rate, tempo,
  virtualRate, virtualTempo, rateChange, and tempoChange setters. Internal
  _rate and _tempo are now always derived from virtualPitch.
  Remove tempo and rate AudioParams from SoundTouchNode. Playback speed is
  controlled exclusively by mirroring playbackRate on both the source node
  and SoundTouchNode.
  Add CLAUDE.md with mandatory code change requirements: JSDoc, tests, and
  documentation gates, plus Conventional Commits table and project conventions.
  Update all READMEs, Storybook stories, and .mdx docs to reflect the current
  public API and remove all references to removed symbols. Consolidate three
  duplicate root-level .mdx files into their beginner-friendly core/ versions.
- **license:** Upgrade LGPL text to version 3  ([#63](https://github.com/cutterbl/SoundTouchJS/pull/63))
  License changed from LGPL-2.1 to LGPL-3.0; review compliance obligations.

### ❤️ Thank You

- Steve 'Cutter' Blades

## 1.0.10 (2026-04-06)

### 🚀 Features

- **demo:** Add loop playback toggle and beginner Web Audio docs ([#58](https://github.com/cutterbl/SoundTouchJS/pull/58), [#31](https://github.com/cutterbl/SoundTouchJS/issues/31))

### 🏡 Chore

- Dependency updates ([#60](https://github.com/cutterbl/SoundTouchJS/pull/60))

### ❤️ Thank You

- Steve 'Cutter' Blades

## 1.0.9 (2026-03-31)

### 🩹 Fixes

- **@soundtouchjs/audio-worklet:** Expand range ([#57](https://github.com/cutterbl/SoundTouchJS/pull/57), [#56](https://github.com/cutterbl/SoundTouchJS/issues/56))

### ❤️ Thank You

- Steve 'Cutter' Blades

## 1.0.8 (2026-03-18)

### 📖 Documentation

- Remove verbose ([8a6aff9](https://github.com/cutterbl/SoundTouchJS/commit/8a6aff9))

### 🤖 CI

- Update dependencies ([#55](https://github.com/cutterbl/SoundTouchJS/pull/55))

### ❤️ Thank You

- Steve 'Cutter' Blades

## 1.0.7 (2026-03-09)

### 🩹 Fixes

- **@soundtouchjs/core:** Versioning ([#53](https://github.com/cutterbl/SoundTouchJS/pull/53))

### ❤️ Thank You

- Steve 'Cutter' Blades

# Changelog

All notable changes to this project will be documented in this file.

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

## 0.3.0 (2026-02-04)

### ⚠ BREAKING CHANGES

- Update all dependencies, and retool build configs for proper ESM outpu

### Features

- Refactor ([#36](https://github.com/cutterbl/SoundTouchJS/issues/36)) ([f3a1dfa](https://github.com/cutterbl/SoundTouchJS/commit/f3a1dfa419fa392327ebd40e606900794bfb68e1))

## 0.2.3 (2026-02-04)

### Bug Fixes

- Try new build ([#35](https://github.com/cutterbl/SoundTouchJS/issues/35)) ([93ebb31](https://github.com/cutterbl/SoundTouchJS/commit/93ebb314a31669e44b3ce8f15ff16ffad3059888))

## 0.2.2 (2026-02-04)

### Bug Fixes

- properly clear all internal buffers to prevent audio artifacts after seeking ([#34](https://github.com/cutterbl/SoundTouchJS/issues/34)) ([caab98d](https://github.com/cutterbl/SoundTouchJS/commit/caab98d0d6a8060f23429bdaaeb090f55efee989))

## 0.2.1 (2025-03-06)

## 0.2.0 (2025-03-06)

### ⚠ BREAKING CHANGES

- Updates to build dependencies and process (#32)

### Features

- Updates to build dependencies and process ([#32](https://github.com/cutterbl/SoundTouchJS/issues/32)) ([97fc28c](https://github.com/cutterbl/SoundTouchJS/commit/97fc28c839457e2792751060321357342e7e7d34))

### 0.1.30 (2022-05-03)

### 0.1.29 (2021-10-18)

### 0.1.28 (2021-10-18)

### 0.1.27 (2021-05-07)

### 0.1.26 (2021-02-01)

### 0.1.25 (2021-01-19)

### 0.1.24 (2020-09-19)

### 0.1.23 (2020-07-20)

### 0.1.22 (2020-07-20)

### 0.1.21 (2020-05-11)

### 0.1.20 (2020-04-26)

### 0.1.19 (2020-04-23)

### 0.1.18 (2020-04-18)

### 0.1.17 (2020-04-01)

### 0.1.16 (2020-04-01)

### Bug Fixes

- action test step 12 ([8e09725](https://github.com/cutterbl/SoundTouchJS/commit/8e097257dd71d98b49f7a4aaeb409771bd65e1ac))

### 0.1.15 (2020-04-01)

### Bug Fixes

- action test step 11 ([a48aba2](https://github.com/cutterbl/SoundTouchJS/commit/a48aba209c2e0e35629bad5fb8a38b261a3457ee))

### 0.1.14 (2020-04-01)

### Bug Fixes

- action test step 11 ([e60a584](https://github.com/cutterbl/SoundTouchJS/commit/e60a58445f6a8aae4984e68d6ffde25403065765))

### 0.1.13 (2020-04-01)

### 0.1.12 (2020-04-01)

# Change Log

## 5 March, 2018

- Updated dependencies to resolve security issue with their dependencies
- Updated the 'example.js' to account for autoplay policy changes in Chrome. Big Thanks to Colin Hill for reporting it.

## 22 September, 2018

- Custom Event dispatch from the PitchShifter, to broadcast 'play' event
- Add `PitchShifter.on()` and `PitchShifter.off()` methods for registering and destroying event listener on audio node
- **Breaking Changes: ** change PitchShifter.sampleRate and PitchShifter.duration from functions to variables
