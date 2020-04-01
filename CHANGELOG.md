Changelog
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