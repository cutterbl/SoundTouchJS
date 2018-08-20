/**
 * Loosely based on an example from:
 * http://onlinetonegenerator.com/pitch-shifter.html
 */

// This is pulling SoundTouchJS from the local file system. See the README for proper usage.
import {PitchShifter} from './dist/soundtouch.js';

const fileInput = document.getElementById('fileInput');
const playBtn = document.getElementById('play');
const stopBtn = document.getElementById('stop');
const tempoSlider = document.getElementById('tempoSlider');
const tempoOutput = document.getElementById('tempo');
tempoOutput.innerHTML = tempoSlider.value;
const pitchSlider = document.getElementById('pitchSlider');
const pitchOutput = document.getElementById('pitch');
pitchOutput.innerHTML = pitchSlider.value;
const keySlider = document.getElementById('keySlider');
const keyOutput = document.getElementById('key');
keyOutput.innerHTML = keySlider.value;
const volumeSlider = document.getElementById('volumeSlider');
const volumeOutput = document.getElementById('volume');
volumeOutput.innerHTML = volumeSlider.value;
const currTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const progressMeter = document.getElementById('progressMeter');


const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioCtx.createGain();
let shifter;

const loadSource = function (url) {
    playBtn.setAttribute('disabled', 'disabled');
    fetch(url)
        .then(response => response.arrayBuffer())
        .then(buffer => {
            console.log('have array buffer');
            audioCtx.decodeAudioData(buffer, (audioBuffer) => {
                console.log('decoded the buffer');
                shifter = new PitchShifter(audioCtx, audioBuffer, 16384);
                shifter.tempo = tempoSlider.value;
                shifter.pitch = pitchSlider.value;
                duration.innerHTML = shifter.formattedDuration;
                playBtn.removeAttribute('disabled');
            });
        })
};

loadSource('./bensound-actionable.mp3');

let is_playing = false;
let intervalId;
const play = function () {
    shifter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    intervalId = setInterval(function () {
        currTime.innerHTML = shifter.timePlayed;
        progressMeter.value = shifter.percentagePlayed;
    }, 1000);
    is_playing = true;
    this.setAttribute('disabled', 'disabled');
};

const pause = function (playing = false) {
    shifter.disconnect();
    clearInterval(intervalId);
    is_playing = playing;
    playBtn.removeAttribute('disabled');
};

playBtn.onclick = play;
stopBtn.onclick = pause;

tempoSlider.addEventListener('input', function() {
    tempoOutput.innerHTML = shifter.tempo = this.value;

});

pitchSlider.addEventListener('input', function() {
    pitchOutput.innerHTML = shifter.pitch = this.value;
    shifter.tempo = tempoSlider.value;
});

keySlider.addEventListener('input', function() {
    shifter.pitchSemitones = this.value;
    keyOutput.innerHTML = this.value / 2;
    shifter.tempo = tempoSlider.value;
});

volumeSlider.addEventListener('input', function() {
    volumeOutput.innerHTML = gainNode.gain.value = this.value;
});

progressMeter.addEventListener('click', function (event) {
    const pos = event.target.getBoundingClientRect();
    const relX = event.pageX - pos.x;
    const perc = relX / event.target.offsetWidth;
    console.log('perc', perc);
    pause(is_playing);
    shifter.percentagePlayed = perc;
    progressMeter.value = (100 * perc);
    currTime.innerHTML = shifter.timePlayed;
    if (is_playing) {
        play();
    }
});