import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import {
  type ChangeEvent,
  type MouseEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import processorModuleUrl from '../../../packages/audio-worklet/src/processor.ts?url';
import actionableTrack from '../../../apps/demo/public/bensound-actionable.mp3?url';
import downtownTrack from '../../../apps/demo/public/bensound-downtown.mp3?url';
import happinessTrack from '../../../apps/demo/public/bensound-happiness.mp3?url';
import hipjazzTrack from '../../../apps/demo/public/bensound-hipjazz.mp3?url';
import retrosoulTrack from '../../../apps/demo/public/bensound-retrosoul.mp3?url';

type SourceMode = 'buffer' | 'element';
type SampleBufferType = 'fifo' | 'circular';
type InterpolationStrategy = 'linear' | 'lanczos8';

interface AudioTrack {
  id: string;
  label: string;
  url: string;
}

const TRACKS: AudioTrack[] = [
  { id: 'actionable', label: 'Bensound Actionable', url: actionableTrack },
  { id: 'downtown', label: 'Bensound Downtown', url: downtownTrack },
  { id: 'happiness', label: 'Bensound Happiness', url: happinessTrack },
  { id: 'hipjazz', label: 'Bensound Hip Jazz', url: hipjazzTrack },
  { id: 'retrosoul', label: 'Bensound Retro Soul', url: retrosoulTrack },
];

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds - minutes * 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

interface SoundTouchPlaygroundProps {
  title: string;
  sourceMode: SourceMode;
  sampleBufferType: SampleBufferType;
  interpolationStrategy: InterpolationStrategy;
  defaultTrackId: string;
}

export function SoundTouchPlayground({
  title,
  sourceMode,
  sampleBufferType,
  interpolationStrategy,
  defaultTrackId,
}: SoundTouchPlaygroundProps): JSX.Element {
  const [selectedTrackId, setSelectedTrackId] = useState(defaultTrackId);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Idle');
  const idPrefix = useId();

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const soundTouchNodeRef = useRef<SoundTouchNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const bufferSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const elementSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const startAtContextTimeRef = useRef(0);
  const sourceOffsetRef = useRef(0);
  const rafIdRef = useRef(0);

  const track = useMemo(
    () => TRACKS.find((item) => item.id === selectedTrackId) ?? TRACKS[0],
    [selectedTrackId],
  );

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumeListId = `${idPrefix}-volume`;
  const rateListId = `${idPrefix}-rate`;
  const pitchListId = `${idPrefix}-pitch`;
  const pitchSemitonesListId = `${idPrefix}-pitch-semitones`;

  const ensureGraph = async (): Promise<void> => {
    if (
      audioContextRef.current &&
      soundTouchNodeRef.current &&
      gainNodeRef.current
    ) {
      return;
    }

    const context = new AudioContext();
    await SoundTouchNode.register(context, processorModuleUrl);

    const gainNode = context.createGain();
    const soundTouchNode = new SoundTouchNode({
      context,
      sampleBufferType,
      interpolationStrategy,
    });

    soundTouchNode.connect(gainNode);
    gainNode.connect(context.destination);

    audioContextRef.current = context;
    gainNodeRef.current = gainNode;
    soundTouchNodeRef.current = soundTouchNode;
  };

  const loadTrack = async (): Promise<void> => {
    await ensureGraph();

    if (sourceMode === 'buffer') {
      const response = await fetch(track.url);
      const arrayBuffer = await response.arrayBuffer();
      audioBufferRef.current =
        await audioContextRef.current!.decodeAudioData(arrayBuffer);
      setDuration(audioBufferRef.current.duration);
      setCurrentTime(0);
      sourceOffsetRef.current = 0;
      setStatus(`Loaded ${track.label} (manual buffer)`);
      return;
    }

    if (!elementRef.current) {
      elementRef.current = new Audio();
    }

    elementRef.current.src = track.url;
    elementRef.current.loop = loopEnabled;
    elementRef.current.preservesPitch = false;
    elementRef.current.playbackRate = rate;

    if (!elementSourceNodeRef.current) {
      elementSourceNodeRef.current =
        audioContextRef.current!.createMediaElementSource(elementRef.current);
      elementSourceNodeRef.current.connect(soundTouchNodeRef.current!);
    }

    await new Promise<void>((resolve, reject) => {
      if (!elementRef.current) {
        reject(new Error('Audio element unavailable.'));
        return;
      }

      const handleLoaded = (): void => {
        elementRef.current?.removeEventListener('loadedmetadata', handleLoaded);
        elementRef.current?.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = (): void => {
        elementRef.current?.removeEventListener('loadedmetadata', handleLoaded);
        elementRef.current?.removeEventListener('error', handleError);
        reject(new Error('Unable to load audio element source.'));
      };

      elementRef.current.addEventListener('loadedmetadata', handleLoaded);
      elementRef.current.addEventListener('error', handleError);
      elementRef.current.load();
    });

    setDuration(elementRef.current.duration || 0);
    setCurrentTime(0);
    setStatus(`Loaded ${track.label} (audio element)`);
  };

  const stopBufferPlayback = (): void => {
    if (bufferSourceNodeRef.current) {
      bufferSourceNodeRef.current.onended = null;
      bufferSourceNodeRef.current.stop();
      bufferSourceNodeRef.current.disconnect();
      bufferSourceNodeRef.current = null;
    }
  };

  const syncNodeParameters = (): void => {
    if (!soundTouchNodeRef.current || !gainNodeRef.current) {
      return;
    }

    soundTouchNodeRef.current.playbackRate.value = rate;
    soundTouchNodeRef.current.pitch.value = pitch;
    soundTouchNodeRef.current.pitchSemitones.value = pitchSemitones;
    gainNodeRef.current.gain.value = volume;
  };

  const tick = (): void => {
    if (!isPlaying) {
      return;
    }

    if (sourceMode === 'buffer') {
      const elapsed =
        sourceOffsetRef.current +
        (audioContextRef.current!.currentTime - startAtContextTimeRef.current) *
          rate;
      const next =
        loopEnabled && duration > 0
          ? elapsed % duration
          : Math.min(elapsed, duration);
      setCurrentTime(next);
      if (!loopEnabled && elapsed >= duration) {
        setIsPlaying(false);
        setStatus('Playback complete');
        return;
      }
    } else {
      setCurrentTime(elementRef.current?.currentTime ?? 0);
    }

    rafIdRef.current = window.requestAnimationFrame(tick);
  };

  const startPlayback = async (): Promise<void> => {
    try {
      await ensureGraph();
      await audioContextRef.current!.resume();
      syncNodeParameters();

      if (sourceMode === 'buffer') {
        if (!audioBufferRef.current) {
          await loadTrack();
        }
        if (!audioBufferRef.current) {
          return;
        }

        stopBufferPlayback();

        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBufferRef.current;
        source.loop = loopEnabled;
        source.playbackRate.value = rate;
        source.connect(soundTouchNodeRef.current!);

        bufferSourceNodeRef.current = source;
        startAtContextTimeRef.current = audioContextRef.current!.currentTime;
        source.start(0, sourceOffsetRef.current);
        source.onended = () => {
          if (!loopEnabled) {
            setIsPlaying(false);
            setStatus('Playback stopped');
          }
        };
      } else {
        if (!elementRef.current || elementRef.current.src !== track.url) {
          await loadTrack();
        }
        if (!elementRef.current) {
          return;
        }

        elementRef.current.loop = loopEnabled;
        elementRef.current.preservesPitch = false;
        elementRef.current.playbackRate = rate;
        await elementRef.current.play();
      }

      setIsPlaying(true);
      setStatus('Playing');
      rafIdRef.current = window.requestAnimationFrame(tick);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown audio error';
      setStatus(`Error: ${message}`);
    }
  };

  const stopPlayback = (): void => {
    if (sourceMode === 'buffer') {
      if (isPlaying) {
        sourceOffsetRef.current +=
          (audioContextRef.current!.currentTime -
            startAtContextTimeRef.current) *
          rate;
      }
      if (duration > 0) {
        sourceOffsetRef.current = loopEnabled
          ? sourceOffsetRef.current % duration
          : Math.min(sourceOffsetRef.current, duration);
      }
      stopBufferPlayback();
    } else if (elementRef.current) {
      elementRef.current.pause();
    }

    window.cancelAnimationFrame(rafIdRef.current);
    setIsPlaying(false);
    setStatus('Stopped');
  };

  const handleSeek = (event: MouseEvent<HTMLProgressElement>): void => {
    if (duration <= 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width),
    );
    const nextTime = ratio * duration;

    if (sourceMode === 'buffer') {
      sourceOffsetRef.current = nextTime;
      setCurrentTime(nextTime);
      if (isPlaying) {
        void startPlayback();
      }
      return;
    }

    if (elementRef.current) {
      elementRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  const onTrackChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedTrackId(event.target.value);
    setStatus('Track changed. Press Load to prepare audio.');
  };

  useEffect(() => {
    syncNodeParameters();

    if (sourceMode === 'element' && elementRef.current) {
      elementRef.current.playbackRate = rate;
    }
  }, [rate, pitch, pitchSemitones, volume, sourceMode]);

  useEffect(() => {
    if (sourceMode === 'element' && elementRef.current) {
      elementRef.current.loop = loopEnabled;
    }

    if (sourceMode === 'buffer' && bufferSourceNodeRef.current) {
      bufferSourceNodeRef.current.loop = loopEnabled;
    }
  }, [loopEnabled, sourceMode]);

  useEffect(() => {
    stopPlayback();
    audioBufferRef.current = null;
    sourceOffsetRef.current = 0;
    setCurrentTime(0);
    void loadTrack();
  }, [selectedTrackId]);

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(rafIdRef.current);
      stopBufferPlayback();
      if (elementRef.current) {
        elementRef.current.pause();
      }
      void audioContextRef.current?.close();
    };
  }, []);

  return (
    <div
      style={{
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        padding: '1rem',
        maxWidth: 920,
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Source:{' '}
        <strong>
          {sourceMode === 'buffer'
            ? 'Manual buffer load'
            : 'HTML audio element'}
        </strong>{' '}
        | Buffer:
        <strong> {sampleBufferType}</strong> | Interpolation:
        <strong> {interpolationStrategy}</strong>
      </p>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
        }}
      >
        <label>
          Track
          <select
            value={selectedTrackId}
            onChange={onTrackChange}
            style={{ display: 'block', width: '100%' }}
          >
            {TRACKS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Volume: {volume.toFixed(2)}
          <input
            type="range"
            min={0}
            max={10}
            step={0.01}
            list={volumeListId}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id={volumeListId}>
            <option value="0" />
            <option value="0.5" />
            <option value="1" />
            <option value="1.5" />
            <option value="2" />
            <option value="2.5" />
            <option value="3" />
            <option value="3.5" />
            <option value="4" />
            <option value="4.5" />
            <option value="5" />
            <option value="5.5" />
            <option value="6" />
            <option value="6.5" />
            <option value="7" />
            <option value="7.5" />
            <option value="8" />
            <option value="8.5" />
            <option value="9" />
            <option value="9.5" />
            <option value="10" />
          </datalist>
        </label>

        <label>
          Rate: {rate.toFixed(2)}
          <input
            type="range"
            min={0.1}
            max={4}
            step={0.01}
            list={rateListId}
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id={rateListId}>
            <option value="0.1" />
            <option value="0.5" />
            <option value="1" />
            <option value="1.5" />
            <option value="2" />
            <option value="2.5" />
            <option value="3" />
            <option value="3.5" />
            <option value="4" />
          </datalist>
        </label>

        <label>
          Pitch: {pitch.toFixed(2)}
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.01}
            list={pitchListId}
            value={pitch}
            onChange={(event) => setPitch(Number(event.target.value))}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id={pitchListId}>
            <option value="0.1" />
            <option value="0.5" />
            <option value="1" />
            <option value="1.5" />
            <option value="2" />
          </datalist>
        </label>

        <label>
          Pitch semitones: {pitchSemitones}
          <input
            type="range"
            min={-7}
            max={7}
            step={1}
            list={pitchSemitonesListId}
            value={pitchSemitones}
            onChange={(event) => setPitchSemitones(Number(event.target.value))}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id={pitchSemitonesListId}>
            <option value="-7" />
            <option value="-6" />
            <option value="-5" />
            <option value="-4" />
            <option value="-3" />
            <option value="-2" />
            <option value="-1" />
            <option value="0" />
            <option value="1" />
            <option value="2" />
            <option value="3" />
            <option value="4" />
            <option value="5" />
            <option value="6" />
            <option value="7" />
          </datalist>
        </label>

        <label style={{ alignSelf: 'end' }}>
          <input
            type="checkbox"
            checked={loopEnabled}
            onChange={(event) => setLoopEnabled(event.target.checked)}
          />{' '}
          Loop playback
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <button type="button" onClick={() => void loadTrack()}>
          Load
        </button>
        <button
          type="button"
          onClick={() => void startPlayback()}
          disabled={isPlaying}
        >
          Play
        </button>
        <button type="button" onClick={stopPlayback} disabled={!isPlaying}>
          Stop
        </button>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <progress
          max={100}
          value={progressPercent}
          onClick={handleSeek}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '0.25rem',
            fontSize: '0.9rem',
          }}
        >
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <p style={{ marginBottom: 0, marginTop: '0.75rem', color: '#374151' }}>
        {status}
      </p>
    </div>
  );
}
