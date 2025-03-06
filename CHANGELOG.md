Changelog
## 0.2.1 (2025-03-06)

## 0.2.0 (2025-03-06)


### ⚠ BREAKING CHANGES

* Updates to build dependencies and process (#32)

### Features

* Updates to build dependencies and process ([#32](https://github.com/cutterbl/SoundTouchJS/issues/32)) ([97fc28c](https://github.com/cutterbl/SoundTouchJS/commit/97fc28c839457e2792751060321357342e7e7d34))

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

* action test step 12 ([8e09725](https://github.com/cutterbl/SoundTouchJS/commit/8e097257dd71d98b49f7a4aaeb409771bd65e1ac))

### 0.1.15 (2020-04-01)


### Bug Fixes

* action test step 11 ([a48aba2](https://github.com/cutterbl/SoundTouchJS/commit/a48aba209c2e0e35629bad5fb8a38b261a3457ee))

### 0.1.14 (2020-04-01)


### Bug Fixes

* action test step 11 ([e60a584](https://github.com/cutterbl/SoundTouchJS/commit/e60a58445f6a8aae4984e68d6ffde25403065765))

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