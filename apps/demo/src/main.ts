import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

type SourceMode = 'buffer' | 'element';
type InterpolationStrategy = 'linear' | 'lanczos';

/**
 * Demo architecture in one sentence:
 * source node (AudioBufferSourceNode or HTMLMediaElement) -> SoundTouchNode -> GainNode -> destination.
 *
 * Cause/effect summary:
 * - Source playbackRate controls transport speed (tempo).
 * - SoundTouchNode.playbackRate mirrors source playbackRate so pitch compensation is correct.
 * - SoundTouchNode.pitch and pitchSemitones apply musical pitch changes on top.
 *
 * For a full beginner-focused Web Audio walkthrough, see ../README.md in this app.
 */

function formatTime(secs: number): string {
  const mins = Math.floor(secs / 60);
  const seconds = Math.floor(secs - mins * 60);
  return `${mins}:${String(seconds).padStart(2, '0')}`;
}

// --- DOM refs ---
const modeBufferBtn = document.getElementById(
  'modeBuffer',
) as HTMLButtonElement;
const modeElementBtn = document.getElementById(
  'modeElement',
) as HTMLButtonElement;
const bufferControls = document.getElementById(
  'bufferControls',
) as HTMLDivElement;
const elementControls = document.getElementById(
  'elementControls',
) as HTMLDivElement;
const playBtn = document.getElementById('play') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const tempoSlider = document.getElementById('tempoSlider') as HTMLInputElement;
const tempoOutput = document.getElementById('tempo') as HTMLDivElement;
tempoOutput.innerHTML = tempoSlider.value;
const pitchSlider = document.getElementById('pitchSlider') as HTMLInputElement;
const pitchOutput = document.getElementById('pitch') as HTMLDivElement;
pitchOutput.innerHTML = pitchSlider.value;
const keySlider = document.getElementById('keySlider') as HTMLInputElement;
const keyOutput = document.getElementById('key') as HTMLDivElement;
keyOutput.innerHTML = keySlider.value;
const volumeSlider = document.getElementById(
  'volumeSlider',
) as HTMLInputElement;
const volumeOutput = document.getElementById('volume') as HTMLDivElement;
volumeOutput.innerHTML = volumeSlider.value;
const currTime = document.getElementById('currentTime') as HTMLSpanElement;
const duration = document.getElementById('duration') as HTMLSpanElement;
const progressMeter = document.getElementById(
  'progressMeter',
) as HTMLProgressElement;
const loopToggle = document.getElementById('loopToggle') as HTMLInputElement;
const audioEl = document.getElementById('audioEl') as HTMLAudioElement;
const codeBlock = document.getElementById('codeBlock') as HTMLDivElement;
const circularAdapterToggle = document.getElementById(
  'circularAdapterToggle',
) as HTMLInputElement;
const adapterMode = document.getElementById('adapterMode') as HTMLDivElement;
const interpolationToggle = document.getElementById(
  'interpolationToggle',
) as HTMLInputElement;
const interpolationMode = document.getElementById(
  'interpolationMode',
) as HTMLDivElement;

const searchParams = new URLSearchParams(window.location.search);
const useFifoSampleBuffers = searchParams.get('sampleBufferType') === 'fifo';
const interpolationStrategy: InterpolationStrategy =
  searchParams.get('interpolationStrategy') === 'linear'
    ? 'linear'
    : 'lanczos';

function getAdapterModeLabel(): string {
  return useFifoSampleBuffers
    ? 'FIFO sample buffers enabled'
    : 'Circular sample buffers enabled (default)';
}

function getInterpolationModeLabel(): string {
  return interpolationStrategy === 'lanczos'
    ? 'Lanczos interpolation enabled (default)'
    : 'Linear interpolation enabled (override)';
}

function getNodeOptionsSnippet(): string {
  if (!useFifoSampleBuffers && interpolationStrategy === 'lanczos') {
    return 'const stNode = new SoundTouchNode({ context: audioCtx });';
  }

  const options = [`context: audioCtx`];
  if (useFifoSampleBuffers) {
    options.push(`sampleBufferType: 'fifo'`);
  }
  if (interpolationStrategy === 'linear') {
    options.push(`interpolationStrategy: 'linear'`);
  }

  return `const stNode = new SoundTouchNode({
  ${options.join(',\n  ')},
});`;
}

// --- State ---
// `pauseOffset` is tracked in source-time seconds (not wall clock time).
// This lets seek/pause/resume stay correct when tempo changes.
let audioCtx: AudioContext;
let gainNode: GainNode;
let stNode: SoundTouchNode;
let sourceNode: AudioBufferSourceNode | undefined;
let elementSourceNode: MediaElementAudioSourceNode | undefined;
let audioBuffer: AudioBuffer | undefined;
let isPlaying = false;
let playStartTime = 0;
let pauseOffset = 0;
let rafId = 0;
let currentTempo = 1;
let currentPitch = 1;
let loopEnabled = false;
let activeMode: SourceMode = 'buffer';

// --- Code snippets ---
const BUFFER_CODE = `import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);

await SoundTouchNode.register(audioCtx, '/soundtouch-processor.js');
${getNodeOptionsSnippet()}
stNode.connect(gainNode);

const response = await fetch('/audio.mp3');
const buffer = await response.arrayBuffer();
const audioBuffer = await audioCtx.decodeAudioData(buffer);

const source = audioCtx.createBufferSource();
source.buffer = audioBuffer;
source.loop = true;
source.playbackRate.value = tempo;    // tempo via playback rate
source.connect(stNode);

stNode.playbackRate.value = tempo;    // tell processor the source rate
stNode.pitch.value = pitch;           // desired pitch (auto-compensated)
stNode.pitchSemitones.value = key;
gainNode.gain.value = volume;

source.start();`;

const ELEMENT_CODE = `import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

const audioEl = document.querySelector('audio')!;
const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);

await SoundTouchNode.register(audioCtx, '/soundtouch-processor.js');
${getNodeOptionsSnippet()}
stNode.connect(gainNode);

const source = audioCtx.createMediaElementSource(audioEl);
source.connect(stNode);

audioEl.loop = true;
audioEl.preservesPitch = false;       // let SoundTouch handle pitch
audioEl.playbackRate = tempo;         // tempo via element playback rate
stNode.playbackRate.value = tempo;    // tell processor the source rate
stNode.pitch.value = pitch;           // desired pitch (auto-compensated)
stNode.pitchSemitones.value = key;
gainNode.gain.value = volume;`;

// --- Init ---
async function init(): Promise<void> {
  audioCtx = new AudioContext();
  gainNode = audioCtx.createGain();
  await SoundTouchNode.register(audioCtx, '/soundtouch-processor.js');
  stNode = new SoundTouchNode({
    context: audioCtx,
    sampleBufferType: useFifoSampleBuffers ? 'fifo' : 'circular',
    interpolationStrategy,
  });
  stNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);
}

const ready = init();

async function loadAudioBuffer(url: string): Promise<void> {
  playBtn.setAttribute('disabled', 'disabled');
  await ready;
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  audioBuffer = await audioCtx.decodeAudioData(buffer);
  pauseOffset = 0;
  duration.innerHTML = formatTime(audioBuffer.duration);
  playBtn.removeAttribute('disabled');
}

function connectAudioElement(): void {
  if (elementSourceNode) return;
  elementSourceNode = audioCtx.createMediaElementSource(audioEl);
  elementSourceNode.connect(stNode);
}

/**
 * Converts an arbitrary source-time position into a valid playback offset.
 *
 * Cause/effect:
 * - Loop off  -> clamp to end of file.
 * - Loop on   -> wrap around with modulo so repeated playback stays continuous.
 */
function normalizeOffset(position: number): number {
  if (!audioBuffer) return position;
  if (audioBuffer.duration <= 0) return 0;
  if (loopEnabled) {
    return position % audioBuffer.duration;
  }
  return Math.min(position, audioBuffer.duration);
}

/**
 * Single source of truth for loop state.
 * Applies the toggle to both playback modes so behavior is predictable when switching modes.
 */
function setLoop(enabled: boolean): void {
  loopEnabled = enabled;
  loopToggle.checked = enabled;
  if (sourceNode) {
    sourceNode.loop = enabled;
  }
  audioEl.loop = enabled;
}

// --- Buffer mode: play/pause/progress ---
/**
 * UI progress is derived from source-time, not output-time.
 * This keeps the meter aligned with seek and tempo changes.
 */
function updateProgress(): void {
  if (!audioBuffer || !isPlaying) return;
  const wallElapsed = audioCtx.currentTime - playStartTime;
  const sourceElapsed = pauseOffset + wallElapsed * currentTempo;
  const displayElapsed = loopEnabled
    ? sourceElapsed % audioBuffer.duration
    : sourceElapsed;
  const perc = loopEnabled
    ? displayElapsed / audioBuffer.duration
    : Math.min(displayElapsed / audioBuffer.duration, 1);
  currTime.innerHTML = formatTime(displayElapsed);
  progressMeter.value = perc * 100;
  if (!loopEnabled && perc >= 1) {
    bufferPause();
    return;
  }
  rafId = requestAnimationFrame(updateProgress);
}

/**
 * AudioBufferSourceNode is one-shot, so every play/resume creates a new source node.
 * The offset determines where playback begins in the source buffer.
 */
function bufferPlay(): void {
  if (!audioBuffer) return;
  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.loop = loopEnabled;
  sourceNode.playbackRate.value = currentTempo;
  sourceNode.connect(stNode);
  stNode.playbackRate.value = currentTempo;

  pauseOffset = normalizeOffset(pauseOffset);
  playStartTime = audioCtx.currentTime;
  sourceNode.start(0, pauseOffset);
  sourceNode.onended = () => {
    if (isPlaying && !loopEnabled) bufferPause();
  };

  audioCtx.resume().then(() => {
    isPlaying = true;
    playBtn.setAttribute('disabled', 'disabled');
    rafId = requestAnimationFrame(updateProgress);
  });
}

/**
 * Stops the current source node and converts wall-clock elapsed time back into source-time offset.
 * This is what makes pause/resume and tempo edits deterministic.
 */
function bufferPause(resume = false): void {
  if (sourceNode) {
    sourceNode.onended = null;
    sourceNode.stop();
    sourceNode.disconnect();
    sourceNode = undefined;
  }
  if (isPlaying) {
    pauseOffset += (audioCtx.currentTime - playStartTime) * currentTempo;
    pauseOffset = normalizeOffset(pauseOffset);
  }
  cancelAnimationFrame(rafId);
  isPlaying = resume;
  playBtn.removeAttribute('disabled');
}

// --- Element mode ---
/**
 * For media elements, playbackRate changes transport speed and would normally pitch-shift.
 * Setting preservesPitch=false delegates pitch handling to SoundTouch for consistent behavior.
 */
function elementPlay(): void {
  audioCtx.resume();
  connectAudioElement();
  audioEl.loop = loopEnabled;
  audioEl.preservesPitch = false;
  audioEl.playbackRate = currentTempo;
  stNode.playbackRate.value = currentTempo;
  audioEl.play();
}

// --- Mode switching ---
/**
 * Switching mode resets transport-related UI state while keeping processing graph intact.
 * This avoids stale offsets from one source type leaking into the other.
 */
function setMode(mode: SourceMode): void {
  if (isPlaying) {
    if (activeMode === 'buffer') bufferPause();
    else audioEl.pause();
  }
  pauseOffset = 0;
  isPlaying = false;
  activeMode = mode;

  modeBufferBtn.classList.toggle('active', mode === 'buffer');
  modeElementBtn.classList.toggle('active', mode === 'element');
  bufferControls.style.display = mode === 'buffer' ? '' : 'none';
  elementControls.style.display = mode === 'element' ? '' : 'none';
  codeBlock.textContent = mode === 'buffer' ? BUFFER_CODE : ELEMENT_CODE;

  currentTempo = 1;
  currentPitch = 1;
  tempoSlider.value = '1';
  tempoOutput.innerHTML = '1';
  pitchSlider.value = '1';
  pitchOutput.innerHTML = '1';
  keySlider.value = '0';
  keyOutput.innerHTML = '0';
  volumeSlider.value = '1';
  volumeOutput.innerHTML = '1';
  stNode?.pitch && (stNode.pitch.value = 1);
  stNode?.pitchSemitones && (stNode.pitchSemitones.value = 0);
  gainNode && (gainNode.gain.value = 1);
}

modeBufferBtn.onclick = () => setMode('buffer');
modeElementBtn.onclick = () => setMode('element');
circularAdapterToggle.checked = useFifoSampleBuffers;
adapterMode.textContent = getAdapterModeLabel();
interpolationToggle.checked = interpolationStrategy === 'linear';
interpolationMode.textContent = getInterpolationModeLabel();
circularAdapterToggle.onchange = () => {
  const next = new URLSearchParams(window.location.search);
  if (circularAdapterToggle.checked) {
    next.set('sampleBufferType', 'fifo');
  } else {
    next.delete('sampleBufferType');
  }
  const query = next.toString();
  window.location.search = query.length > 0 ? `?${query}` : '';
};
interpolationToggle.onchange = () => {
  const next = new URLSearchParams(window.location.search);
  if (interpolationToggle.checked) {
    next.set('interpolationStrategy', 'linear');
  } else {
    next.delete('interpolationStrategy');
  }
  const query = next.toString();
  window.location.search = query.length > 0 ? `?${query}` : '';
};

// --- Load and set initial mode ---
loadAudioBuffer('./bensound-actionable.mp3');
setMode('buffer');

playBtn.onclick = bufferPlay;
stopBtn.onclick = () => bufferPause();
loopToggle.onchange = () => setLoop(loopToggle.checked);
setLoop(false);

tempoSlider.addEventListener('input', () => {
  const newTempo = Number(tempoSlider.value);
  if (activeMode === 'buffer') {
    // Fold elapsed wall time into source offset before changing tempo,
    // then restart accumulation from the new tempo.
    if (isPlaying) {
      pauseOffset += (audioCtx.currentTime - playStartTime) * currentTempo;
      pauseOffset = normalizeOffset(pauseOffset);
      playStartTime = audioCtx.currentTime;
    }
    if (sourceNode) sourceNode.playbackRate.value = newTempo;
  } else {
    audioEl.preservesPitch = false;
    audioEl.playbackRate = newTempo;
  }
  currentTempo = newTempo;
  stNode.playbackRate.value = currentTempo;
  stNode.pitch.value = currentPitch;
  tempoOutput.innerHTML = tempoSlider.value;
});

pitchSlider.addEventListener('input', () => {
  currentPitch = Number(pitchSlider.value);
  stNode.pitch.value = currentPitch;
  pitchOutput.innerHTML = pitchSlider.value;
});

keySlider.addEventListener('input', () => {
  stNode.pitchSemitones.value = Number(keySlider.value);
  keyOutput.innerHTML = String(Number(keySlider.value) / 2);
});

volumeSlider.addEventListener('input', () => {
  gainNode.gain.value = Number(volumeSlider.value);
  volumeOutput.innerHTML = volumeSlider.value;
});

progressMeter.addEventListener('click', (event: MouseEvent) => {
  if (activeMode !== 'buffer' || !audioBuffer) return;
  const target = event.target as HTMLProgressElement;
  const pos = target.getBoundingClientRect();
  const relX = event.pageX - pos.x;
  const perc = relX / target.offsetWidth;
  const wasPlaying = isPlaying;
  bufferPause();
  pauseOffset = perc * audioBuffer.duration;
  progressMeter.value = 100 * perc;
  currTime.innerHTML = formatTime(pauseOffset);
  if (wasPlaying) {
    bufferPlay();
  }
});

audioEl.addEventListener('play', () => {
  if (activeMode === 'element') {
    elementPlay();
  }
});
