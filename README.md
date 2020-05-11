# SoundTouchJS

**[Note]: Check out the [AudioWorklet implementation of SoundTouchJS](https://github.com/cutterbl/soundtouchjs-audio-worklet)**

SoundTouchJS is an ES2015 library of audio context utilities, converted, expanded, and maintained by Cutter. [Read the backstory](#in-case-you-are-interested). To see it in action:

[![Edit SoundTouchJS with React](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/soundtouchjs-with-react-qdci0?fontsize=14&hidenavigation=1&theme=dark)

Or, clone the repo and [Run The Example](#running-the-example).

## Installation

You can easily install **SoundTouchJS** for use in your project:

```
npm install soundtouchjs
```

## General Usage

You can use whatever method you prefer to **get** your audio file, but once you have the data you must decode it into an [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer). Once you've decoded the data you can then create a new [PitchShifter](#PitchShifter).

```javascript
import { PitchShifter } from 'soundtouchjs';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioCtx.createGain();
let shifter;

// here you retrieved your file with 'fetch' or a new instance of the 'FileReader', and from the data...
if (shifter) {
  shifter.off(); // remove any current listeners
}
audioCtx.decodeAudioData(buffer, (audioBuffer) => {
  shifter = new PitchShifter(audioCtx, audioBuffer, 1024);
  shifter.on('play', (detail) => {
    // do something with detail.timePlayed;
    // do something with detail.formattedTimePlayed;
    // do something with detail.percentagePlayed
  });
  shifter.tempo = 1;
  shifter.pitch = 1;
});
```

To begin playback you connect the `PitchShifter` to the WebAudio destination (or another node), and disconnect it to pause. It's important to note that the `PitchShifter` is a pseudo-node, and cannot be connected to.

```javascript
const play = function () {
  shifter.connect(gainNode); // connect it to a GainNode to control the volume
  gainNode.connect(audioCtx.destination); // attach the GainNode to the 'destination' to begin playback
};
```

## Running The Example

An example has been included with the package to see some basic functionality. Prior to running the example you must install all dependencies.

```
npm i
```

If you've cloned the library, you need to build the code.

```
npm run build
```

It has been written in pure javascript, but could easily be integrated with your favorite framework.

**Note: Run the example in a modern browser, as it uses es2015 `import` syntax.**

To run the example:

```
npm start
```

then open your browser to `http://localhost:8080`. A royalty free music file is included under Creative Commons License with this repository.

Music: "Actionable" from [Bensound.com](http://bensound.com).

This is a limited use license, and we do not grant any permissions beyond theirs. Please refer to [their licensing](https://www.bensound.com/licensing) for further information.

All core components of the package are available as separate entities for more advanced audio manipulations. See the source code for greater understanding.

## Creating Your Own Build

As long as you've installed all dependencies, you can run the build script to create your own local version of SoundTouchJS. This is good when contributing changes back to the project.

```
npm run build
```

## Contributing

If you want to contribute, Hooray! Just fork the repo, do your work in a branch, then submit a Pull Request when you're done. Code? Documentation? More Examples? Go for it!

Or maybe you just like what's been done? [I accept cash](https://paypal.me/cutterbl?locale.x=en_US)

### TODO

- audio worklets - (Thank You to [Janick Delot](https://github.com/watch-janick) for sponsoring this upcoming feature)

## In Case You Are Interested

SoundTouchJS is based on the C++ implementation of [Soundtouch](https://www.surina.net/soundtouch/) by Olli Parviainen. The earliest implementation in JavaScript was written by [Ryan Berdeen](https://github.com/also/soundtouch-js) and later expanded by [Jakub Faila](https://github.com/jakubfiala/soundtouch-js). I have further expanded this library into a distributable package, refactored for es2015 development.

This package includes the `getWebAudioNode` utility written by [Adrian Holovaty](https://github.com/adrianholovaty), as well as the user-friendly `PitchShifter` wrapper from [Jakub Faila](https://github.com/jakubfiala/soundtouch-js).

## Contributors

- [Steve 'Cutter' Blades](https://cutterscrossing.com)
- [Olli Parviainen](https://www.surina.net/soundtouch/)
- [Ray Berdeen](http://ryanberdeen.com)
- [Jakub Faila](http://fiala.space)
- [Adrian Holovaty](http://www.holovaty.com)
