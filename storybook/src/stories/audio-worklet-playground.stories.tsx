import type { Meta, StoryObj } from '@storybook/react-vite';

import { AudioWorkletPlayground } from './AudioWorkletPlayground';

const meta = {
  title: 'Playground',
  component: AudioWorkletPlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof AudioWorkletPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Volume: Story = {
  render: () => (
    <AudioWorkletPlayground
      title="Volume"
      mode="volume"
      description="Adjust output gain while keeping pitch and playback speed unchanged. Selecting a different track rebuilds the audio context and node graph."
      codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorModuleUrl);
const soundTouchNode = new SoundTouchNode({ context });
const gainNode = context.createGain();

soundTouchNode.connect(gainNode);
gainNode.connect(context.destination);

const volumeSlider = document.querySelector<HTMLInputElement>('#volume');
volumeSlider?.addEventListener('input', (event) => {
  const input = event.currentTarget as HTMLInputElement;
  gainNode.gain.value = Number(input.value);
});`}
      explanation="Volume adjusts loudness through a GainNode after SoundTouch processing. Keep values around 0.8–1.2 for transparent changes, and use higher values sparingly to avoid clipping."
    />
  ),
};

export const Pitch: Story = {
  render: () => (
    <AudioWorkletPlayground
      title="Pitch"
      mode="pitch"
      description="Adjust pitch continuously with a multiplier. Selecting a different track rebuilds the audio context and node graph."
      codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorModuleUrl);
const soundTouchNode = new SoundTouchNode({ context });

const pitchSlider = document.querySelector<HTMLInputElement>('#pitch');
pitchSlider?.addEventListener('input', (event) => {
  const input = event.currentTarget as HTMLInputElement;
  soundTouchNode.pitch.value = Number(input.value);
});`}
      explanation="Pitch changes perceived note height without using playbackRate directly. Values below 1 lower pitch; values above 1 raise it. Use subtle changes (0.9–1.1) for natural results."
    />
  ),
};

export const PitchSemitones: Story = {
  render: () => (
    <AudioWorkletPlayground
      title="Pitch semitones (Key)"
      mode="pitch-semitones"
      description="Shift pitch in musical semitone steps for key changes. Selecting a different track rebuilds the audio context and node graph."
      codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorModuleUrl);
const soundTouchNode = new SoundTouchNode({ context });

const keySlider = document.querySelector<HTMLInputElement>('#pitch-semitones');
keySlider?.addEventListener('input', (event) => {
  const input = event.currentTarget as HTMLInputElement;
  soundTouchNode.pitchSemitones.value = Number(input.value);
});`}
      explanation="Semitone control is best for musical transposition. Try +12/-12 for one octave shifts, or ±2 for quick key matching between songs."
    />
  ),
};

export const PlaybackRate: Story = {
  render: () => (
    <AudioWorkletPlayground
      title="Playback Rate"
      mode="rate"
      description="Adjust playbackRate through the worklet for speed-up/slow-down effects. Selecting a different track rebuilds the audio context and node graph."
      codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorModuleUrl);
const soundTouchNode = new SoundTouchNode({ context });

const rateSlider = document.querySelector<HTMLInputElement>('#rate');
rateSlider?.addEventListener('input', (event) => {
  const input = event.currentTarget as HTMLInputElement;
  soundTouchNode.playbackRate.value = Number(input.value);
});`}
      explanation="Playback rate changes overall transport speed. Use <1 for slow practice mode, >1 for fast review mode. For speech, small increments (1.0–1.5) usually sound best."
    />
  ),
};

export const LoopedPlayback: Story = {
  render: () => (
    <AudioWorkletPlayground
      title="Looped playback"
      mode="loop"
      description="Toggle seamless looping to repeatedly audition a track segment. Selecting a different track rebuilds the audio context and node graph."
      codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorModuleUrl);
const soundTouchNode = new SoundTouchNode({ context });
const source = context.createBufferSource();

source.connect(soundTouchNode);
source.loop = false;

const loopToggle = document.querySelector<HTMLInputElement>('#loop-enabled');
loopToggle?.addEventListener('change', (event) => {
  const input = event.currentTarget as HTMLInputElement;
  source.loop = input.checked;
});`}
      explanation="Looping is useful for beat matching, A/B tests, and focused listening. Turn looping off to validate transitions or full-track timing behavior."
    />
  ),
};

export const Buffer: Story = {
  render: () => (
    <AudioWorkletPlayground
      title="Buffer (Kitchen sink)"
      mode="buffer"
      description="Experiment with volume, pitch, playback rate, loop, track selection, and buffer type in one place. Selecting a different track rebuilds the audio context and node graph."
      codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorModuleUrl);

const soundTouchNode = new SoundTouchNode({
  context,
  sampleBufferType: 'fifo', // non-default; default is 'circular'
});

soundTouchNode.playbackRate.value = 1.0;
soundTouchNode.pitch.value = 1.0;

const volumeSlider = document.querySelector<HTMLInputElement>('#volume');
volumeSlider?.addEventListener('input', (event) => {
  const input = event.currentTarget as HTMLInputElement;
  // update your gain node here
});`}
      explanation="The default internal buffer type is circular, which works well for most use cases and requires no configuration. Switch to fifo when you want to compare behavior with an alternate buffering strategy."
    />
  ),
};

export const InterpolationStrategy: Story = {
  render: () => (
    <AudioWorkletPlayground
      title="Interpolation strategy (Kitchen sink)"
      mode="interpolation-strategy"
      description="Experiment with volume, pitch, playback rate, loop, track selection, and interpolation strategy in one place. Selecting a different track rebuilds the audio context and node graph."
      codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorModuleUrl);

const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: 'linear', // non-default; default is 'lanczos8'
});

const rateSlider = document.querySelector<HTMLInputElement>('#rate');
rateSlider?.addEventListener('input', (event) => {
  const input = event.currentTarget as HTMLInputElement;
  soundTouchNode.playbackRate.value = Number(input.value);
});`}
      explanation="Lanczos8 is the default strategy and typically offers higher quality resampling. Linear interpolation can be faster and may be sufficient for low-latency or preview workflows."
    />
  ),
};

export const ElementTransportKitchenSink: Story = {
  render: () => (
    <AudioWorkletPlayground
      title="Element transport (Kitchen sink)"
      mode="element-kitchen-sink"
      sourceMode="element"
      description="Experiment with pitch, pitch semitones, loop, track selection, and seek while native HTMLAudioElement controls own transport, volume, and playback rate."
      codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorModuleUrl);

const stNode = new SoundTouchNode({ context });
const gainNode = context.createGain();
stNode.connect(gainNode);
gainNode.connect(context.destination);

const audio = new Audio('/audio.mp3');
audio.preservesPitch = false;
audio.playbackRate = 1;
audio.loop = false;

const source = context.createMediaElementSource(audio);
source.connect(stNode);

// Native element controls are enabled in markup:
// <audio controls src="/audio.mp3" preload="auto"></audio>

audio.addEventListener('play', async () => {
  await context.resume();
});

audio.addEventListener('ratechange', () => {
  // Keep SoundTouch compensation in sync with element playbackRate changes.
  stNode.playbackRate.value = audio.playbackRate;
});

audio.addEventListener('volumechange', () => {
  // Optional: mirror element volume to downstream gain if desired.
  // gainNode.gain.value = audio.volume;
});`}
      explanation="This kitchen sink demonstrates element-native transport: the audio element’s built-in controls own play/pause, seek, volume, and playback speed, while SoundTouchNode remains synced through playbackRate for compensation."
    />
  ),
};
