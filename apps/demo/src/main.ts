import { PitchShifter, type PlayEventDetail } from '@soundtouchjs/core';

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

const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();
let shifter: PitchShifter | undefined;

const loadSource = (url: string): void => {
  playBtn.setAttribute('disabled', 'disabled');
  if (shifter) {
    shifter.off();
  }
  fetch(url)
    .then((response) => response.arrayBuffer())
    .then((buffer) => {
      audioCtx.decodeAudioData(buffer, (audioBuffer) => {
        shifter = new PitchShifter(audioCtx, audioBuffer, 16384);
        shifter.tempo = Number(tempoSlider.value);
        shifter.pitch = Number(pitchSlider.value);
        shifter.on('play', (detail: PlayEventDetail) => {
          currTime.innerHTML = detail.formattedTimePlayed;
          progressMeter.value = detail.percentagePlayed;
        });
        duration.innerHTML = shifter.formattedDuration;
        playBtn.removeAttribute('disabled');
      });
    });
};

loadSource('./bensound-actionable.mp3');

let isPlaying = false;

const play = (): void => {
  if (!shifter) return;
  shifter.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  audioCtx.resume().then(() => {
    isPlaying = true;
    playBtn.setAttribute('disabled', 'disabled');
  });
};

const pause = (playing = false): void => {
  if (!shifter) return;
  shifter.disconnect();
  isPlaying = playing;
  playBtn.removeAttribute('disabled');
};

playBtn.onclick = play;
stopBtn.onclick = () => pause();

tempoSlider.addEventListener('input', () => {
  if (!shifter) return;
  shifter.tempo = Number(tempoSlider.value);
  tempoOutput.innerHTML = tempoSlider.value;
});

pitchSlider.addEventListener('input', () => {
  if (!shifter) return;
  shifter.pitch = Number(pitchSlider.value);
  pitchOutput.innerHTML = pitchSlider.value;
  shifter.tempo = Number(tempoSlider.value);
});

keySlider.addEventListener('input', () => {
  if (!shifter) return;
  shifter.pitchSemitones = Number(keySlider.value);
  keyOutput.innerHTML = String(Number(keySlider.value) / 2);
  shifter.tempo = Number(tempoSlider.value);
});

volumeSlider.addEventListener('input', () => {
  gainNode.gain.value = Number(volumeSlider.value);
  volumeOutput.innerHTML = volumeSlider.value;
});

progressMeter.addEventListener('click', (event: MouseEvent) => {
  if (!shifter) return;
  const target = event.target as HTMLProgressElement;
  const pos = target.getBoundingClientRect();
  const relX = event.pageX - pos.x;
  const perc = relX / target.offsetWidth;
  pause(isPlaying);
  shifter.percentagePlayed = perc;
  progressMeter.value = 100 * perc;
  currTime.innerHTML = String(shifter.timePlayed);
  if (isPlaying) {
    play();
  }
});
