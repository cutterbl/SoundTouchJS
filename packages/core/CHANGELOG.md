## 2.0.3 (2026-05-15)

### Bug Fixes

- **release:** Use flat projectsRelationship, remove per-package GitHub releases ([#77](https://github.com/cutterbl/SoundTouchJS/pull/77))

### ❤️ Thank You

- Steve 'Cutter' Blades

## 2.0.2 (2026-05-15)

### Bug Fixes

- **release:** Set releaseTagPattern to match existing v{version} git tags ([#76](https://github.com/cutterbl/SoundTouchJS/pull/76))
- Release conventional commits ([#75](https://github.com/cutterbl/SoundTouchJS/pull/75))
- **release:** Remove duplicate conventionalCommits from version config ([#74](https://github.com/cutterbl/SoundTouchJS/pull/74))
- Release ([#73](https://github.com/cutterbl/SoundTouchJS/pull/73))
- Release ([#72](https://github.com/cutterbl/SoundTouchJS/pull/72))
- **ci:** Allow workflow_dispatch to bypass release commit check ([#70](https://github.com/cutterbl/SoundTouchJS/pull/70))
- **ci:** Remove paths-ignore from storybook pages trigger, add workflow_dispatch ([#69](https://github.com/cutterbl/SoundTouchJS/pull/69))

### ❤️ Thank You

- Steve 'Cutter' Blades

## 2.0.1 (2026-05-15)

This was a version bump only for @soundtouchjs/core to align it with other projects, there were no code changes.

# 2.0.0 (2026-05-14)

### 🚀 Features

- Add live processor metrics to Storybook playgrounds ([f41f2e8](https://github.com/cutterbl/SoundTouchJS/commit/f41f2e8))
- Refactor processing pipeline and update interpolation strategy integrations ([529a3e5](https://github.com/cutterbl/SoundTouchJS/commit/529a3e5))
- **audio-worklet:** Add formant correction worklet ([1d5b049](https://github.com/cutterbl/SoundTouchJS/commit/1d5b049))
- **audio-worklet:** Add phase vocoder packages ([60d7277](https://github.com/cutterbl/SoundTouchJS/commit/60d7277))
- **core:** Add StretchPipe interface and stretchFactory option ([e3341fc](https://github.com/cutterbl/SoundTouchJS/commit/e3341fc))
- **core,audio-worklet:** Expose WSOLA timing parameters ([c8196a8](https://github.com/cutterbl/SoundTouchJS/commit/c8196a8))
- ⚠️  Remove legacy ScriptProcessorNode API and simplify SoundTouch controls ([2047920](https://github.com/cutterbl/SoundTouchJS/commit/2047920))
- Add Hann, Blackman, and Kaiser interpolation strategy packages ([58ccc34](https://github.com/cutterbl/SoundTouchJS/commit/58ccc34))
- **workspace:** Add Storybook docs and interpolation strategy packages ([bf9ebb6](https://github.com/cutterbl/SoundTouchJS/commit/bf9ebb6))
- Update README to reflect LGPL-3.0 license upgrade ([#64](https://github.com/cutterbl/SoundTouchJS/pull/64))

### 💅 Refactors

- **core,docs:** Standardize interpolation strategy IDs and params\n\n- Rename all strategy IDs (hann8, blackman8, kaiser8, lanczos8) to (hann, blackman, kaiser, lanczos)\n- Standardize on zeroCrossings for kernel width param\n- Update all code, tests, and docs for new naming and parameter conventions\n- Remove deprecated lanczos8-strategy.mdx and update navigation\n- Add and update kitchen sink playgrounds for all strategies ([7c6ff25](https://github.com/cutterbl/SoundTouchJS/commit/7c6ff25))

### 📖 Documentation

- **repo-management:** Update stage and commit instructions for Husky pre-commit hook ([6f28f52](https://github.com/cutterbl/SoundTouchJS/commit/6f28f52))
- **repo-management:** Update stage and commit instructions for Husky pre-commit hook ([533f7b5](https://github.com/cutterbl/SoundTouchJS/commit/533f7b5))
- Add Husky pre-commit hook instructions to repo-management ([20b816b](https://github.com/cutterbl/SoundTouchJS/commit/20b816b))
- Update stage and commit instructions for Husky pre-commit hook ([d1d4701](https://github.com/cutterbl/SoundTouchJS/commit/d1d4701))

### 🏡 Chore

- Run lint in pre-commit hook ([880ef24](https://github.com/cutterbl/SoundTouchJS/commit/880ef24))
- **agents:** Nx agent config ([50417a2](https://github.com/cutterbl/SoundTouchJS/commit/50417a2))
- **docs:** Enrich CLAUDE.md with commands, architecture, and project conventions ([94d114b](https://github.com/cutterbl/SoundTouchJS/commit/94d114b))
- Align interpolation strategy params, tests, and Storybook docs ([3a803da](https://github.com/cutterbl/SoundTouchJS/commit/3a803da))
- Remove package coverage artifacts and update Storybook links ([2fb4792](https://github.com/cutterbl/SoundTouchJS/commit/2fb4792))
- Commit current in-progress workspace state ([63bfd48](https://github.com/cutterbl/SoundTouchJS/commit/63bfd48))
- ⚠️  **license:** Upgrade LGPL text to version 3 ([#63](https://github.com/cutterbl/SoundTouchJS/pull/63))

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
