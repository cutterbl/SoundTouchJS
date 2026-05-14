import { SoundTouchNode, type ProcessorMetrics } from '@soundtouchjs/audio-worklet';
import { PhaseVocoderNode } from '@soundtouchjs/phase-vocoder-worklet';

type PhaseVocoderFftSize = 512 | 1024 | 2048 | 4096;
type PhaseVocoderOverlapFactor = 2 | 4 | 8;
import { FormantCorrectionNode } from '@soundtouchjs/formant-correction-worklet';
import strategyInstallerUrl from './interpolation-strategies.installers.ts?url';

type SourceMode = 'buffer' | 'element';
type NodeType = 'soundtouch' | 'phase-vocoder' | 'formant-correction';
type StrategyId = 'lanczos' | 'linear' | 'hann' | 'blackman' | 'kaiser';
type AnyNode = SoundTouchNode | PhaseVocoderNode | FormantCorrectionNode;

/**
 * Demo architecture:
 * source (AudioBufferSourceNode or MediaElementAudioSourceNode)
 *   → active node (SoundTouchNode | PhaseVocoderNode | FormantCorrectionNode)
 *   → GainNode → destination
 *
 * Switching node type rebuilds the middle segment without touching the source or gain.
 * Switching strategy calls setInterpolationStrategy() in-place (no rebuild).
 */

function formatTime(secs: number): string {
  const mins = Math.floor(secs / 60);
  const seconds = Math.floor(secs - mins * 60);
  return `${mins}:${String(seconds).padStart(2, '0')}`;
}

// --- DOM refs ---
const modeBufferBtn = document.getElementById('modeBuffer') as HTMLButtonElement;
const modeElementBtn = document.getElementById('modeElement') as HTMLButtonElement;
const bufferControls = document.getElementById('bufferControls') as HTMLDivElement;
const elementControls = document.getElementById('elementControls') as HTMLDivElement;
const playBtn = document.getElementById('play') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const tempoSlider = document.getElementById('tempoSlider') as HTMLInputElement;
const tempoOutput = document.getElementById('tempo') as HTMLSpanElement;
const pitchSlider = document.getElementById('pitchSlider') as HTMLInputElement;
const pitchOutput = document.getElementById('pitch') as HTMLSpanElement;
const keySlider = document.getElementById('keySlider') as HTMLInputElement;
const keyOutput = document.getElementById('key') as HTMLSpanElement;
const volumeSlider = document.getElementById('volumeSlider') as HTMLInputElement;
const volumeOutput = document.getElementById('volume') as HTMLSpanElement;
const currTime = document.getElementById('currentTime') as HTMLSpanElement;
const duration = document.getElementById('duration') as HTMLSpanElement;
const progressMeter = document.getElementById('progressMeter') as HTMLProgressElement;
const loopToggle = document.getElementById('loopToggle') as HTMLInputElement;
const audioEl = document.getElementById('audioEl') as HTMLAudioElement;
const codeBlock = document.getElementById('codeBlock') as HTMLDivElement;
const circularAdapterToggle = document.getElementById('circularAdapterToggle') as HTMLInputElement;
const adapterMode = document.getElementById('adapterMode') as HTMLDivElement;
const trackSelect = document.getElementById('trackSelect') as HTMLSelectElement;
const nodeTypeSelect = document.getElementById('nodeTypeSelect') as HTMLSelectElement;
const pvOptions = document.getElementById('pvOptions') as HTMLDivElement;
const fcOptions = document.getElementById('fcOptions') as HTMLDivElement;
const fftSizeSelect = document.getElementById('fftSizeSelect') as HTMLSelectElement;
const overlapFactorSelect = document.getElementById('overlapFactorSelect') as HTMLSelectElement;
const formantStrengthSlider = document.getElementById(
  'formantStrengthSlider',
) as HTMLInputElement;
const formantStrengthOutput = document.getElementById(
  'formantStrengthOutput',
) as HTMLSpanElement;
const strategySelect = document.getElementById('strategySelect') as HTMLSelectElement;
const metricsFrames = document.getElementById('metricsFrames') as HTMLSpanElement;
const metricsUnderruns = document.getElementById('metricsUnderruns') as HTMLSpanElement;
const metricsBlocks = document.getElementById('metricsBlocks') as HTMLSpanElement;

// Sync initial display values with slider defaults
tempoOutput.textContent = Number(tempoSlider.value).toFixed(2);
pitchOutput.textContent = Number(pitchSlider.value).toFixed(2);
keyOutput.textContent = keySlider.value;
volumeOutput.textContent = Number(volumeSlider.value).toFixed(2);

const searchParams = new URLSearchParams(window.location.search);
const useFifoSampleBuffers = searchParams.get('sampleBufferType') === 'fifo';

// --- State ---
let audioCtx: AudioContext;
let gainNode: GainNode;
let stNode: AnyNode;
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
let activeNodeType: NodeType = 'soundtouch';
let activeStrategy: StrategyId = 'lanczos';
let pvFftSize: PhaseVocoderFftSize = 2048;
let pvOverlapFactor: PhaseVocoderOverlapFactor = 4;
let fcFormantStrength = 1.0;
let currentTrack = './bensound-actionable.mp3';

// --- Node factory ---
function createNode(): AnyNode {
  if (activeNodeType === 'phase-vocoder') {
    return new PhaseVocoderNode({
      context: audioCtx,
      sampleBufferType: useFifoSampleBuffers ? 'fifo' : 'circular',
      fftSize: pvFftSize,
      overlapFactor: pvOverlapFactor,
      interpolationStrategy: activeStrategy,
    });
  }
  if (activeNodeType === 'formant-correction') {
    const node = new FormantCorrectionNode({
      context: audioCtx,
      sampleBufferType: useFifoSampleBuffers ? 'fifo' : 'circular',
      interpolationStrategy: activeStrategy,
    });
    node.formantStrength.value = fcFormantStrength;
    return node;
  }
  return new SoundTouchNode({
    context: audioCtx,
    sampleBufferType: useFifoSampleBuffers ? 'fifo' : 'circular',
    interpolationStrategy: activeStrategy,
  });
}

function applyCurrentParamsToNode(): void {
  stNode.playbackRate.value = currentTempo;
  stNode.pitch.value = currentPitch;
  stNode.pitchSemitones.value = Number(keySlider.value);
  if (stNode instanceof FormantCorrectionNode) {
    stNode.formantStrength.value = fcFormantStrength;
  }
}

function attachMetricsListener(): void {
  stNode.addEventListener('metrics', (e: Event) => {
    const { framesBuffered, underrunCount, blockCount } = (
      e as CustomEvent<ProcessorMetrics>
    ).detail;
    metricsFrames.textContent = String(framesBuffered);
    metricsUnderruns.textContent = String(underrunCount);
    metricsBlocks.textContent = String(blockCount);
  });
}

// --- Code snippet generation ---
function getNodeClass(): string {
  if (activeNodeType === 'phase-vocoder') return 'PhaseVocoderNode';
  if (activeNodeType === 'formant-correction') return 'FormantCorrectionNode';
  return 'SoundTouchNode';
}

function getImportLine(): string {
  if (activeNodeType === 'phase-vocoder')
    return `import { PhaseVocoderNode } from '@soundtouchjs/phase-vocoder-worklet';`;
  if (activeNodeType === 'formant-correction')
    return `import { FormantCorrectionNode } from '@soundtouchjs/formant-correction-worklet';`;
  return `import { SoundTouchNode } from '@soundtouchjs/audio-worklet';`;
}

function getRegisterLine(): string {
  const cls = getNodeClass();
  if (activeNodeType === 'phase-vocoder')
    return `await ${cls}.register(audioCtx, '/phase-vocoder-processor.js');`;
  if (activeNodeType === 'formant-correction')
    return `await ${cls}.register(audioCtx, '/formant-correction-processor.js');`;
  return `await ${cls}.register(audioCtx, '/soundtouch-processor.js');`;
}

function getStrategyLine(): string {
  if (activeStrategy === 'lanczos') return '';
  const cls = getNodeClass();
  return `await ${cls}.registerStrategyModule(audioCtx, strategyInstallerUrl);\n`;
}

function getNodeConstruct(): string {
  if (activeNodeType === 'phase-vocoder') {
    return `const node = new PhaseVocoderNode({
  context: audioCtx,
  fftSize: ${pvFftSize},
  overlapFactor: ${pvOverlapFactor},
  interpolationStrategy: '${activeStrategy}',
});`;
  }
  if (activeNodeType === 'formant-correction') {
    return `const node = new FormantCorrectionNode({
  context: audioCtx,
  interpolationStrategy: '${activeStrategy}',
});
node.formantStrength.value = ${fcFormantStrength.toFixed(2)};`;
  }
  const opts: string[] = ['context: audioCtx'];
  if (useFifoSampleBuffers) opts.push(`sampleBufferType: 'fifo'`);
  if (activeStrategy !== 'lanczos') opts.push(`interpolationStrategy: '${activeStrategy}'`);
  if (opts.length === 1) return `const node = new SoundTouchNode({ context: audioCtx });`;
  return `const node = new SoundTouchNode({\n  ${opts.join(',\n  ')},\n});`;
}

function buildBufferCode(): string {
  return `${getImportLine()}

const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);

${getRegisterLine()}
${getStrategyLine()}${getNodeConstruct()}
node.connect(gainNode);

const response = await fetch('/audio.mp3');
const buffer = await response.arrayBuffer();
const audioBuffer = await audioCtx.decodeAudioData(buffer);

const source = audioCtx.createBufferSource();
source.buffer = audioBuffer;
source.loop = true;
source.playbackRate.value = tempo;    // tempo via playback rate
source.connect(node);

node.playbackRate.value = tempo;      // tell processor the source rate
node.pitch.value = pitch;             // desired pitch (auto-compensated)
node.pitchSemitones.value = key;
gainNode.gain.value = volume;

source.start();`;
}

function buildElementCode(): string {
  return `${getImportLine()}

const audioEl = document.querySelector('audio')!;
const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);

${getRegisterLine()}
${getStrategyLine()}${getNodeConstruct()}
node.connect(gainNode);

const source = audioCtx.createMediaElementSource(audioEl);
source.connect(node);

audioEl.loop = true;
audioEl.preservesPitch = false;       // let SoundTouch handle pitch
audioEl.playbackRate = tempo;         // tempo via element playback rate
node.playbackRate.value = tempo;      // tell processor the source rate
node.pitch.value = pitch;             // desired pitch (auto-compensated)
node.pitchSemitones.value = key;
gainNode.gain.value = volume;`;
}

function updateCodeBlock(): void {
  codeBlock.textContent = activeMode === 'buffer' ? buildBufferCode() : buildElementCode();
}

// --- Init ---
async function init(): Promise<void> {
  audioCtx = new AudioContext();
  gainNode = audioCtx.createGain();

  await Promise.all([
    SoundTouchNode.register(audioCtx, '/soundtouch-processor.js'),
    PhaseVocoderNode.register(audioCtx, '/phase-vocoder-processor.js'),
    FormantCorrectionNode.register(audioCtx, '/formant-correction-processor.js'),
  ]);

  // Load strategy plugins into the AudioWorklet scope once; all three processors share it.
  await SoundTouchNode.registerStrategyModule(audioCtx, strategyInstallerUrl);

  stNode = createNode();
  stNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  attachMetricsListener();
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
 * Loop off → clamp to end. Loop on → wrap with modulo.
 */
function normalizeOffset(position: number): number {
  if (!audioBuffer) return position;
  if (audioBuffer.duration <= 0) return 0;
  if (loopEnabled) return position % audioBuffer.duration;
  return Math.min(position, audioBuffer.duration);
}

/**
 * Single source of truth for loop state across both playback modes.
 */
function setLoop(enabled: boolean): void {
  loopEnabled = enabled;
  loopToggle.checked = enabled;
  if (sourceNode) sourceNode.loop = enabled;
  audioEl.loop = enabled;
}

// --- Buffer mode ---
/**
 * UI progress is derived from source-time, not output-time, so the meter
 * stays aligned with seek and tempo changes.
 */
function updateProgress(): void {
  if (!audioBuffer || !isPlaying) return;
  const wallElapsed = audioCtx.currentTime - playStartTime;
  const sourceElapsed = pauseOffset + wallElapsed * currentTempo;
  const displayElapsed = loopEnabled ? sourceElapsed % audioBuffer.duration : sourceElapsed;
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
 * AudioBufferSourceNode is one-shot — every play/resume creates a new source node.
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
 * Stops the source node and converts wall-clock elapsed time back into source-time offset.
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
 * preservesPitch=false delegates pitch handling to the active node.
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

// --- Node rebuild (called when switching type or PV-specific options) ---
function rebuildNode(): void {
  if (!stNode) return;

  if (isPlaying) {
    if (activeMode === 'buffer') bufferPause();
    else audioEl.pause();
  }

  if (elementSourceNode) elementSourceNode.disconnect(stNode);
  stNode.disconnect(gainNode);

  stNode = createNode();
  stNode.connect(gainNode);

  if (elementSourceNode) elementSourceNode.connect(stNode);

  attachMetricsListener();
  applyCurrentParamsToNode();
}

function updateNodeOptionsPanel(): void {
  pvOptions.style.display = activeNodeType === 'phase-vocoder' ? '' : 'none';
  fcOptions.style.display = activeNodeType === 'formant-correction' ? '' : 'none';
}

// --- Mode switching ---
/**
 * Resets transport state; keeps the processing graph intact.
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

  currentTempo = 1;
  currentPitch = 1;
  tempoSlider.value = '1';
  tempoOutput.textContent = '1.00';
  pitchSlider.value = '1';
  pitchOutput.textContent = '1.00';
  keySlider.value = '0';
  keyOutput.textContent = '0';
  volumeSlider.value = '1';
  volumeOutput.textContent = '1.00';
  if (stNode?.pitch) stNode.pitch.value = 1;
  if (stNode?.pitchSemitones) stNode.pitchSemitones.value = 0;
  if (gainNode) gainNode.gain.value = 1;

  updateCodeBlock();
}

// --- Wire up controls ---
modeBufferBtn.onclick = () => setMode('buffer');
modeElementBtn.onclick = () => setMode('element');

circularAdapterToggle.checked = useFifoSampleBuffers;
adapterMode.textContent = useFifoSampleBuffers
  ? 'FIFO sample buffers enabled'
  : 'Circular sample buffers enabled (default)';
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

trackSelect.onchange = () => {
  currentTrack = trackSelect.value;
  if (activeMode === 'buffer') {
    if (isPlaying) bufferPause();
    loadAudioBuffer(currentTrack);
  } else {
    audioEl.src = currentTrack;
    audioEl.load();
  }
};

nodeTypeSelect.onchange = () => {
  activeNodeType = nodeTypeSelect.value as NodeType;
  updateNodeOptionsPanel();
  rebuildNode();
  updateCodeBlock();
};

fftSizeSelect.onchange = () => {
  pvFftSize = Number(fftSizeSelect.value) as PhaseVocoderFftSize;
  if (activeNodeType === 'phase-vocoder') rebuildNode();
  updateCodeBlock();
};

overlapFactorSelect.onchange = () => {
  pvOverlapFactor = Number(overlapFactorSelect.value) as PhaseVocoderOverlapFactor;
  if (activeNodeType === 'phase-vocoder') rebuildNode();
  updateCodeBlock();
};

formantStrengthSlider.addEventListener('input', () => {
  fcFormantStrength = Number(formantStrengthSlider.value);
  formantStrengthOutput.textContent = fcFormantStrength.toFixed(2);
  if (stNode instanceof FormantCorrectionNode) {
    stNode.formantStrength.value = fcFormantStrength;
  }
});

strategySelect.onchange = () => {
  if (!stNode) return;
  activeStrategy = strategySelect.value as StrategyId;
  stNode.setInterpolationStrategy(activeStrategy);
  updateCodeBlock();
};

// --- Initial load ---
loadAudioBuffer(currentTrack);
setMode('buffer');

playBtn.onclick = bufferPlay;
stopBtn.onclick = () => bufferPause();
loopToggle.onchange = () => setLoop(loopToggle.checked);
setLoop(false);

tempoSlider.addEventListener('input', () => {
  const newTempo = Number(tempoSlider.value);
  if (activeMode === 'buffer') {
    // Fold elapsed wall time into source offset before changing tempo,
    // then restart accumulation from the new rate.
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
  tempoOutput.textContent = newTempo.toFixed(2);
});

pitchSlider.addEventListener('input', () => {
  currentPitch = Number(pitchSlider.value);
  stNode.pitch.value = currentPitch;
  pitchOutput.textContent = currentPitch.toFixed(2);
});

keySlider.addEventListener('input', () => {
  stNode.pitchSemitones.value = Number(keySlider.value);
  keyOutput.textContent = keySlider.value;
});

volumeSlider.addEventListener('input', () => {
  gainNode.gain.value = Number(volumeSlider.value);
  volumeOutput.textContent = Number(volumeSlider.value).toFixed(2);
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
  if (wasPlaying) bufferPlay();
});

audioEl.addEventListener('play', () => {
  if (activeMode === 'element') elementPlay();
});
