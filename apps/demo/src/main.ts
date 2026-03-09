import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

type SourceMode = 'buffer' | 'element';

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
const audioEl = document.getElementById('audioEl') as HTMLAudioElement;
const codeBlock = document.getElementById('codeBlock') as HTMLDivElement;

// --- State ---
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
let activeMode: SourceMode = 'buffer';

// --- Code snippets ---
const BUFFER_CODE = `import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);

await SoundTouchNode.register(audioCtx, '/soundtouch-processor.js');
const stNode = new SoundTouchNode(audioCtx);
stNode.connect(gainNode);

const response = await fetch('/audio.mp3');
const buffer = await response.arrayBuffer();
const audioBuffer = await audioCtx.decodeAudioData(buffer);

const source = audioCtx.createBufferSource();
source.buffer = audioBuffer;
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
const stNode = new SoundTouchNode(audioCtx);
stNode.connect(gainNode);

const source = audioCtx.createMediaElementSource(audioEl);
source.connect(stNode);

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
  stNode = new SoundTouchNode(audioCtx);
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

// --- Buffer mode: play/pause/progress ---
function updateProgress(): void {
  if (!audioBuffer || !isPlaying) return;
  const wallElapsed = audioCtx.currentTime - playStartTime;
  const sourceElapsed = pauseOffset + wallElapsed * currentTempo;
  const perc = Math.min(sourceElapsed / audioBuffer.duration, 1);
  currTime.innerHTML = formatTime(sourceElapsed);
  progressMeter.value = perc * 100;
  if (perc >= 1) {
    bufferPause();
    return;
  }
  rafId = requestAnimationFrame(updateProgress);
}

function bufferPlay(): void {
  if (!audioBuffer) return;
  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.playbackRate.value = currentTempo;
  sourceNode.connect(stNode);
  stNode.playbackRate.value = currentTempo;

  playStartTime = audioCtx.currentTime;
  sourceNode.start(0, pauseOffset);
  sourceNode.onended = () => {
    if (isPlaying) bufferPause();
  };

  audioCtx.resume().then(() => {
    isPlaying = true;
    playBtn.setAttribute('disabled', 'disabled');
    rafId = requestAnimationFrame(updateProgress);
  });
}

function bufferPause(resume = false): void {
  if (sourceNode) {
    sourceNode.onended = null;
    sourceNode.stop();
    sourceNode.disconnect();
    sourceNode = undefined;
  }
  if (isPlaying) {
    pauseOffset += (audioCtx.currentTime - playStartTime) * currentTempo;
  }
  cancelAnimationFrame(rafId);
  isPlaying = resume;
  playBtn.removeAttribute('disabled');
}

// --- Element mode ---
function elementPlay(): void {
  audioCtx.resume();
  connectAudioElement();
  audioEl.preservesPitch = false;
  audioEl.playbackRate = currentTempo;
  stNode.playbackRate.value = currentTempo;
  audioEl.play();
}

// --- Mode switching ---
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

// --- Load and set initial mode ---
loadAudioBuffer('./bensound-actionable.mp3');
setMode('buffer');

playBtn.onclick = bufferPlay;
stopBtn.onclick = () => bufferPause();

tempoSlider.addEventListener('input', () => {
  const newTempo = Number(tempoSlider.value);
  if (activeMode === 'buffer') {
    if (isPlaying) {
      pauseOffset += (audioCtx.currentTime - playStartTime) * currentTempo;
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
