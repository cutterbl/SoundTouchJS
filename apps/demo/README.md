# Demo Guide: Web Audio + SoundTouchJS

This demo is intentionally simple in UI but non-trivial in audio behavior.
If you are new to Web Audio, read this once before editing `src/main.ts`.

## Mental model

Web Audio is a graph of connected nodes:

`source -> processor -> gain -> destination`

In this demo, that graph is:

1. Source:

- `AudioBufferSourceNode` in Buffer mode
- `HTMLAudioElement` (wrapped by `MediaElementAudioSourceNode`) in Element mode

2. Processor:

- `SoundTouchNode` from `@soundtouchjs/audio-worklet`

3. Output control:

- `GainNode` for volume

4. Speakers:

- `audioCtx.destination`

## Why there are two playback modes

The demo shows two common Web Audio input strategies:

1. Buffer mode:

- You fetch/decode audio into an `AudioBuffer`
- You create an `AudioBufferSourceNode` to play it
- Good for precise seeking and custom transport logic

2. Element mode:

- You use a regular `<audio>` element as source
- Good when you want native media controls or browser buffering behavior

Both modes route through `SoundTouchNode` so pitch and tempo controls are consistent.

## Important Web Audio behavior (newcomer checklist)

1. `AudioContext` starts suspended in many browsers until user interaction.

- That is why the demo calls `audioCtx.resume()` in play paths.

2. `AudioBufferSourceNode` is one-shot.

- After `start()`, you cannot restart the same node.
- Pause/resume works by creating a new source node and starting from an offset.

3. `createMediaElementSource()` should be done once per media element and context.

- The demo stores `elementSourceNode` and reuses it.

4. Time domains matter.

- `audioCtx.currentTime` is wall-clock time in the audio engine.
- `pauseOffset` is source time (position in track).
- With tempo changes, converting between these domains is required for accurate progress/seek.

5. Looping belongs to the source transport.

- Buffer mode: `sourceNode.loop`
- Element mode: `audioEl.loop`
- `SoundTouchNode` does processing, not transport lifecycle.

## SoundTouch parameter cause and effect

The demo uses a recommended pairing:

1. Set source playback speed with transport playback rate:

- Buffer mode: `sourceNode.playbackRate.value = tempo`
- Element mode: `audioEl.playbackRate = tempo`

2. Mirror that rate to SoundTouch:

- `stNode.playbackRate.value = tempo`

This keeps SoundTouch's pitch compensation aligned with source speed.

3. Apply pitch controls separately:

- `stNode.pitch.value` for continuous ratio
- `stNode.pitchSemitones.value` for key changes in semitones

4. Set output volume after processing:

- `gainNode.gain.value`

## Why `preservesPitch = false` is set for HTML audio

Browsers often apply their own pitch correction when media playback rate changes.
If that remains enabled, both browser and SoundTouch try to affect pitch.

Setting `audioEl.preservesPitch = false` ensures SoundTouch is the single pitch authority.

## Buffer mode transport logic explained

Buffer mode tracks three things:

1. `playStartTime`:

- `audioCtx.currentTime` at the moment playback started/resumed

2. `pauseOffset`:

- Source position in seconds where playback should start next

3. `currentTempo`:

- Needed to convert elapsed wall time into elapsed source time

When pausing or changing tempo during playback, the demo does:

`pauseOffset += (audioCtx.currentTime - playStartTime) * currentTempo`

This is the key conversion that keeps state coherent.

## Looping behavior details

1. Toggle state is centralized in `setLoop(enabled)`.
2. Existing active source gets updated immediately.
3. New buffer sources inherit loop flag on creation.
4. Progress display wraps with modulo when loop is on.

Without wrapped progress, UI would pin at 100% while audio continues looping.

## Common mistakes and symptoms

1. Forgot `await SoundTouchNode.register(...)`

- Symptom: node creation fails because processor is unknown.

2. Source playback rate and `stNode.playbackRate` are out of sync

- Symptom: pitch sounds wrong when changing tempo.

3. Reusing a started `AudioBufferSourceNode`

- Symptom: no sound after pause/resume attempt.

4. Not calling `audioCtx.resume()` from a user gesture path

- Symptom: graph appears connected but silent.

5. Leaving `audioEl.preservesPitch` enabled

- Symptom: double pitch handling artifacts.

## Fast map from concepts to code

1. Graph setup and processor registration: `src/main.ts` init block
2. Buffer transport lifecycle: `bufferPlay()` and `bufferPause()`
3. Element transport lifecycle: `elementPlay()` and `connectAudioElement()`
4. Loop behavior: `setLoop()` and `updateProgress()`
5. Tempo and pitch controls: slider event handlers at the bottom

## Development tips

1. Change one transport variable at a time (loop, then tempo, then seek).
2. Verify both modes after every change.
3. Keep comments focused on cause/effect, not UI wording.
4. If behavior differs between modes, check source-specific APIs first.

## API references

- SoundTouchNode (AudioWorklet main-thread API): [https://cutterscrossing.com/SoundTouchJS/?path=/docs/audio-worklet-soundtouchnode--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/audio-worklet-soundtouchnode--docs)
- AudioWorklet docs index: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/getting-started--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/getting-started--docs)
- Core docs index: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/core-soundtouch--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/core-soundtouch--docs)

## Sample buffer A/B toggle

The demo uses circular sample buffers by default and can be switched to FIFO buffers:

1. URL: open the demo with `?sampleBufferType=fifo`
2. UI: use the "Use FIFO sample buffers" checkbox (it reloads with the query flag)

Default (no query flag) keeps circular sample buffers enabled.

## Interpolation A/B toggle

The demo defaults to Lanczos interpolation (`lanczos`) and supports a linear override.

1. URL: open the demo with `?interpolationStrategy=linear`
2. UI: use the "Use linear interpolation" checkbox (it reloads with the query flag)

Unchecked uses default Lanczos behavior. Checked forces linear interpolation for side-by-side listening tests.
