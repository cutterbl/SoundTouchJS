import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import type {
  RateTransposerInterpolationStrategy,
  SampleBufferType,
} from '@soundtouchjs/core';
import {
  type ChangeEvent,
  type JSX,
  useCallback,
  useEffect,
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
import interpolationStrategiesInstallerUrl from '../worklet/interpolation-strategies.installers.ts?url';

interface AudioTrack {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

interface DatalistTick {
  readonly value: number;
  readonly label: string;
}

type StoryMode =
  | 'volume'
  | 'pitch'
  | 'pitch-semitones'
  | 'rate'
  | 'loop'
  | 'buffer'
  | 'interpolation-strategy'
  | 'element-kitchen-sink';

type SourceMode = 'buffer' | 'element';

interface AudioWorkletPlaygroundProps {
  readonly title: string;
  readonly description: string;
  readonly codeSample: string;
  readonly explanation: string;
  readonly mode: StoryMode;
  readonly sourceMode?: SourceMode;
}

const TRACKS: readonly AudioTrack[] = [
  { id: 'actionable', label: 'Bensound Actionable', url: actionableTrack },
  { id: 'downtown', label: 'Bensound Downtown', url: downtownTrack },
  { id: 'happiness', label: 'Bensound Happiness', url: happinessTrack },
  { id: 'hipjazz', label: 'Bensound Hip Jazz', url: hipjazzTrack },
  { id: 'retrosoul', label: 'Bensound Retro Soul', url: retrosoulTrack },
];

const VOLUME_TICKS: readonly DatalistTick[] = [
  { value: 0, label: '0' },
  { value: 0.5, label: '0.5' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1.5' },
  { value: 2, label: '2' },
  { value: 2.5, label: '2.5' },
  { value: 3, label: '3' },
  { value: 3.5, label: '3.5' },
  { value: 4, label: '4' },
  { value: 4.5, label: '4.5' },
  { value: 5, label: '5' },
  { value: 5.5, label: '5.5' },
  { value: 6, label: '6' },
  { value: 6.5, label: '6.5' },
  { value: 7, label: '7' },
  { value: 7.5, label: '7.5' },
  { value: 8, label: '8' },
  { value: 8.5, label: '8.5' },
  { value: 9, label: '9' },
  { value: 9.5, label: '9.5' },
  { value: 10, label: '10' },
];

const RATE_TICKS: readonly DatalistTick[] = [
  { value: 0.1, label: '0.1' },
  { value: 0.5, label: '0.5' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1.5' },
  { value: 2, label: '2' },
  { value: 2.5, label: '2.5' },
  { value: 3, label: '3' },
  { value: 3.5, label: '3.5' },
  { value: 4, label: '4' },
];

const PITCH_TICKS: readonly DatalistTick[] = [
  { value: 0.1, label: '0.1' },
  { value: 0.5, label: '0.5' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1.5' },
  { value: 2, label: '2' },
];

const PITCH_SEMITONE_TICKS: readonly DatalistTick[] = [
  { value: -7, label: '-7' },
  { value: -6, label: '-6' },
  { value: -5, label: '-5' },
  { value: -4, label: '-4' },
  { value: -3, label: '-3' },
  { value: -2, label: '-2' },
  { value: -1, label: '-1' },
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
];

const INTERPOLATION_STRATEGY_OPTIONS: ReadonlyArray<{
  readonly value: RateTransposerInterpolationStrategy;
  readonly label: string;
}> = [
  { value: 'lanczos', label: 'Lanczos (default)' },
  { value: 'linear', label: 'Linear' },
  { value: 'hann', label: 'Hann' },
  { value: 'blackman', label: 'Blackman' },
  { value: 'kaiser', label: 'Kaiser' },
];

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds - minutes * 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
  ticks,
  listId,
  disabled,
}: {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly ticks: readonly DatalistTick[];
  readonly listId: string;
  readonly disabled: boolean;
}): JSX.Element {
  return (
    <label style={{ display: 'block' }}>
      {label}: {Number.isInteger(value) ? value : value.toFixed(2)}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        list={listId}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        style={{ display: 'block', width: '100%' }}
      />
      <datalist id={listId}>
        {ticks.map((tick) => (
          <option
            key={`${listId}-${tick.value}`}
            value={tick.value}
            label={tick.label}
          />
        ))}
      </datalist>
    </label>
  );
}

export function AudioWorkletPlayground({
  title,
  description,
  codeSample,
  explanation,
  mode,
  sourceMode = 'buffer',
}: AudioWorkletPlaygroundProps): JSX.Element {
  const [selectedTrackId, setSelectedTrackId] = useState(TRACKS[0].id);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [sampleBufferType, setSampleBufferType] =
    useState<SampleBufferType>('circular');
  const [interpolationStrategy, setInterpolationStrategy] =
    useState<RateTransposerInterpolationStrategy>('lanczos');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Idle');

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const soundTouchNodeRef = useRef<SoundTouchNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const renderedElementRef = useRef<HTMLAudioElement | null>(null);
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const elementSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const startAtContextTimeRef = useRef(0);
  const sourceOffsetRef = useRef(0);
  const rafIdRef = useRef(0);
  const isPlaybackActiveRef = useRef(false);
  const rateRef = useRef(rate);
  const loopEnabledRef = useRef(loopEnabled);
  const durationRef = useRef(duration);
  const pitchRef = useRef(pitch);
  const pitchSemitonesRef = useRef(pitchSemitones);

  const isKitchenSink =
    mode === 'buffer' ||
    mode === 'interpolation-strategy' ||
    mode === 'element-kitchen-sink';

  const showVolume = mode === 'volume' || isKitchenSink;
  const showPitch = mode === 'pitch' || isKitchenSink;
  const showPitchSemitones = mode === 'pitch-semitones' || isKitchenSink;
  const showRate = mode === 'rate' || isKitchenSink;
  const showLoop = mode === 'loop' || isKitchenSink;
  const showBufferType = mode === 'buffer';
  const showInterpolationStrategy = mode === 'interpolation-strategy';
  const shouldShowVolumeControl = showVolume && sourceMode === 'buffer';
  const shouldShowRateControl = showRate && sourceMode === 'buffer';

  const selectedTrack = useMemo(
    () => TRACKS.find((track) => track.id === selectedTrackId) ?? TRACKS[0],
    [selectedTrackId],
  );

  const clearSourceNode = useCallback((): void => {
    if (!sourceNodeRef.current) {
      return;
    }

    sourceNodeRef.current.onended = null;
    sourceNodeRef.current.stop();
    sourceNodeRef.current.disconnect();
    sourceNodeRef.current = null;
  }, []);

  const clearElementPlayback = useCallback((): void => {
    if (!elementRef.current) {
      return;
    }

    elementRef.current.pause();
    elementRef.current.currentTime = 0;
  }, []);

  const teardownGraph = useCallback(async (): Promise<void> => {
    isPlaybackActiveRef.current = false;
    window.cancelAnimationFrame(rafIdRef.current);
    clearSourceNode();
    clearElementPlayback();

    if (audioContextRef.current) {
      await audioContextRef.current.close();
    }

    audioContextRef.current = null;
    gainNodeRef.current = null;
    soundTouchNodeRef.current = null;
    audioBufferRef.current = null;
    elementSourceNodeRef.current = null;
    elementRef.current = null;
    sourceOffsetRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [clearElementPlayback, clearSourceNode]);

  const createGraph = useCallback(async (): Promise<void> => {
    const context = new AudioContext();
    await SoundTouchNode.register(context, processorModuleUrl);
    await SoundTouchNode.registerStrategyModule(
      context,
      interpolationStrategiesInstallerUrl,
    );

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
  }, [interpolationStrategy, sampleBufferType]);

  const syncNodeParameters = useCallback((): void => {
    if (!soundTouchNodeRef.current || !gainNodeRef.current) {
      return;
    }

    if (sourceMode === 'element') {
      gainNodeRef.current.gain.value = 1;
    } else {
      gainNodeRef.current.gain.value = volume;
    }
    soundTouchNodeRef.current.pitch.value = pitch;
    soundTouchNodeRef.current.pitchSemitones.value = pitchSemitones;
    soundTouchNodeRef.current.playbackRate.value =
      sourceMode === 'element' && elementRef.current
        ? elementRef.current.playbackRate
        : rate;

    if (sourceMode === 'buffer' && elementRef.current) {
      elementRef.current.volume = Math.min(1, Math.max(0, volume));
      elementRef.current.playbackRate = rate;
    }
  }, [pitch, pitchSemitones, rate, sourceMode, volume]);

  const loadTrackBuffer = useCallback(async (): Promise<void> => {
    const response = await fetch(selectedTrack.url);
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer =
      await audioContextRef.current!.decodeAudioData(arrayBuffer);

    audioBufferRef.current = decodedBuffer;
    setDuration(decodedBuffer.duration);
    setCurrentTime(0);
    sourceOffsetRef.current = 0;
  }, [selectedTrack.url]);

  const loadTrackElement = useCallback(async (): Promise<void> => {
    const context = audioContextRef.current;
    const soundTouchNode = soundTouchNodeRef.current;
    const element = renderedElementRef.current;

    if (!context || !soundTouchNode || !element) {
      return;
    }

    element.src = selectedTrack.url;
    element.preservesPitch = false;
    element.playbackRate = rateRef.current;
    element.loop = loopEnabledRef.current;

    await new Promise<void>((resolve, reject) => {
      if (element.readyState >= 1) {
        resolve();
        return;
      }

      const handleLoadedMetadata = (): void => {
        element.removeEventListener('loadedmetadata', handleLoadedMetadata);
        element.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = (): void => {
        element.removeEventListener('loadedmetadata', handleLoadedMetadata);
        element.removeEventListener('error', handleError);
        reject(new Error('Unable to load selected audio track.'));
      };

      element.addEventListener('loadedmetadata', handleLoadedMetadata);
      element.addEventListener('error', handleError);
      element.load();
    });

    if (!elementSourceNodeRef.current) {
      elementSourceNodeRef.current = context.createMediaElementSource(element);
      elementSourceNodeRef.current.connect(soundTouchNode);
    }

    elementRef.current = element;

    const knownDuration = Number.isFinite(element.duration)
      ? element.duration
      : 0;
    setDuration(knownDuration);
    setCurrentTime(0);
    sourceOffsetRef.current = 0;

    element.ontimeupdate = () => {
      setCurrentTime(element.currentTime);
    };
    element.onended = () => {
      isPlaybackActiveRef.current = false;
      setIsPlaying(false);
      setStatus('Playback complete');
    };
    element.onplay = () => {
      isPlaybackActiveRef.current = true;
      setIsPlaying(true);
      setStatus('Playing');
      void audioContextRef.current?.resume();
      if (soundTouchNodeRef.current) {
        soundTouchNodeRef.current.pitch.value = pitchRef.current;
        soundTouchNodeRef.current.pitchSemitones.value =
          pitchSemitonesRef.current;
        soundTouchNodeRef.current.playbackRate.value = element.playbackRate;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = 1;
      }
    };
    element.onpause = () => {
      if (element.ended) {
        return;
      }
      isPlaybackActiveRef.current = false;
      setIsPlaying(false);
      setStatus('Paused');
    };
    element.onratechange = () => {
      const nextRate = element.playbackRate;
      rateRef.current = nextRate;
      setRate(nextRate);
      if (soundTouchNodeRef.current) {
        soundTouchNodeRef.current.playbackRate.value = nextRate;
      }
    };
    element.onvolumechange = () => {
      const nextVolume = element.volume;
      setVolume(nextVolume);
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = 1;
      }
    };
  }, [selectedTrack.url]);

  const initializeTrack = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setStatus(`Loading ${selectedTrack.label}...`);

    try {
      await teardownGraph();
      await createGraph();
      if (sourceMode === 'element') {
        await loadTrackElement();
      } else {
        await loadTrackBuffer();
      }
      setStatus(`Loaded ${selectedTrack.label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [
    createGraph,
    loadTrackElement,
    loadTrackBuffer,
    selectedTrack.label,
    sourceMode,
    teardownGraph,
  ]);

  const tick = useCallback((): void => {
    if (!isPlaybackActiveRef.current) {
      return;
    }

    const context = audioContextRef.current;
    if (!context) {
      return;
    }

    if (sourceMode === 'element') {
      const element = elementRef.current;
      if (!element) {
        return;
      }

      setCurrentTime(element.currentTime);

      if (!loopEnabledRef.current && element.ended) {
        isPlaybackActiveRef.current = false;
        setIsPlaying(false);
        setStatus('Playback complete');
        return;
      }

      rafIdRef.current = window.requestAnimationFrame(tick);
      return;
    }

    const elapsed =
      sourceOffsetRef.current +
      (context.currentTime - startAtContextTimeRef.current) * rateRef.current;

    const nextTime =
      loopEnabledRef.current && durationRef.current > 0
        ? elapsed % durationRef.current
        : Math.min(elapsed, durationRef.current);
    setCurrentTime(nextTime);

    if (!loopEnabledRef.current && elapsed >= durationRef.current) {
      isPlaybackActiveRef.current = false;
      setIsPlaying(false);
      setStatus('Playback complete');
      return;
    }

    rafIdRef.current = window.requestAnimationFrame(tick);
  }, [sourceMode]);

  const beginPlaybackFromOffset = useCallback(
    async (offset: number): Promise<void> => {
      if (
        !audioContextRef.current ||
        !soundTouchNodeRef.current ||
        !audioBufferRef.current
      ) {
        return;
      }

      clearSourceNode();
      await audioContextRef.current.resume();
      syncNodeParameters();

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.loop = loopEnabledRef.current;
      source.connect(soundTouchNodeRef.current);
      sourceNodeRef.current = source;
      sourceOffsetRef.current = offset;
      startAtContextTimeRef.current = audioContextRef.current.currentTime;

      source.start(0, offset);
      source.onended = () => {
        if (loopEnabledRef.current) {
          return;
        }
        isPlaybackActiveRef.current = false;
        setIsPlaying(false);
        setStatus('Playback stopped');
      };

      isPlaybackActiveRef.current = true;
      setIsPlaying(true);
      setStatus('Playing');
      rafIdRef.current = window.requestAnimationFrame(tick);
    },
    [clearSourceNode, syncNodeParameters, tick],
  );

  const startPlayback = useCallback(async (): Promise<void> => {
    if (sourceMode === 'element') {
      if (
        !audioContextRef.current ||
        !soundTouchNodeRef.current ||
        !elementRef.current
      ) {
        await initializeTrack();
      }
    } else if (
      !audioContextRef.current ||
      !audioBufferRef.current ||
      !soundTouchNodeRef.current
    ) {
      await initializeTrack();
    }

    if (sourceMode === 'element') {
      if (
        !audioContextRef.current ||
        !soundTouchNodeRef.current ||
        !elementRef.current
      ) {
        return;
      }

      await audioContextRef.current.resume();
      syncNodeParameters();

      elementRef.current.preservesPitch = false;
      elementRef.current.playbackRate = rateRef.current;
      elementRef.current.loop = loopEnabledRef.current;
      return;
    }

    const initialOffset = sourceOffsetRef.current;
    await beginPlaybackFromOffset(initialOffset);
  }, [
    beginPlaybackFromOffset,
    initializeTrack,
    sourceMode,
    syncNodeParameters,
    tick,
  ]);

  const stopPlayback = useCallback((): void => {
    isPlaybackActiveRef.current = false;
    window.cancelAnimationFrame(rafIdRef.current);

    clearSourceNode();
    if (sourceMode === 'element') {
      clearElementPlayback();
    }

    sourceOffsetRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    setStatus('Stopped');
  }, [clearElementPlayback, clearSourceNode, sourceMode]);

  const togglePlayback = useCallback(async (): Promise<void> => {
    if (isLoading) {
      return;
    }

    if (isPlaying) {
      stopPlayback();
      return;
    }

    await startPlayback();
  }, [isLoading, isPlaying, startPlayback, stopPlayback]);

  const handleTrackChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedTrackId(event.target.value);
  };

  const handleSeek = async (nextTime: number): Promise<void> => {
    if (duration <= 0) {
      return;
    }

    const boundedTime = Math.min(duration, Math.max(0, nextTime));
    sourceOffsetRef.current = boundedTime;
    setCurrentTime(boundedTime);

    if (sourceMode === 'element') {
      if (elementRef.current) {
        elementRef.current.currentTime = boundedTime;
      }
      return;
    }

    if (isPlaying) {
      await beginPlaybackFromOffset(boundedTime);
    }
  };

  useEffect(() => {
    syncNodeParameters();
  }, [syncNodeParameters]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    pitchRef.current = pitch;
  }, [pitch]);

  useEffect(() => {
    pitchSemitonesRef.current = pitchSemitones;
  }, [pitchSemitones]);

  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
    if (sourceNodeRef.current) {
      sourceNodeRef.current.loop = loopEnabled;
    }
    if (elementRef.current) {
      elementRef.current.loop = loopEnabled;
    }
  }, [loopEnabled]);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.playbackRate = rate;
    }
  }, [rate]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    void initializeTrack();
  }, [initializeTrack]);

  useEffect(() => {
    return () => {
      void teardownGraph();
    };
  }, [teardownGraph]);

  return (
    <div
      style={{
        maxWidth: 860,
        padding: '1rem',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ marginTop: 0, color: '#4b5563' }}>{description}</p>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}
      >
        <label>
          Track
          <select
            value={selectedTrackId}
            onChange={handleTrackChange}
            disabled={isLoading}
            style={{ display: 'block', width: '100%' }}
          >
            {TRACKS.map((track) => (
              <option key={track.id} value={track.id}>
                {track.label}
              </option>
            ))}
          </select>
        </label>

        {shouldShowVolumeControl ? (
          <RangeControl
            label="Volume"
            min={0}
            max={10}
            step={0.01}
            value={volume}
            onChange={setVolume}
            ticks={VOLUME_TICKS}
            listId="volume-ticks"
            disabled={isLoading}
          />
        ) : null}

        {showPitch ? (
          <RangeControl
            label="Pitch"
            min={0.1}
            max={2}
            step={0.01}
            value={pitch}
            onChange={setPitch}
            ticks={PITCH_TICKS}
            listId="pitch-ticks"
            disabled={isLoading}
          />
        ) : null}

        {showPitchSemitones ? (
          <RangeControl
            label="Pitch semitones"
            min={-7}
            max={7}
            step={1}
            value={pitchSemitones}
            onChange={setPitchSemitones}
            ticks={PITCH_SEMITONE_TICKS}
            listId="pitch-semitones-ticks"
            disabled={isLoading}
          />
        ) : null}

        {shouldShowRateControl ? (
          <RangeControl
            label="Playback Rate"
            min={0.1}
            max={4}
            step={0.01}
            value={rate}
            onChange={setRate}
            ticks={RATE_TICKS}
            listId="rate-ticks"
            disabled={isLoading}
          />
        ) : null}

        {showLoop ? (
          <label style={{ alignSelf: 'end' }}>
            <input
              type="checkbox"
              checked={loopEnabled}
              onChange={(event) => setLoopEnabled(event.target.checked)}
              disabled={isLoading}
            />{' '}
            Loop playback
          </label>
        ) : null}

        {showBufferType ? (
          <fieldset
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 6,
            }}
          >
            <legend>Buffer type</legend>
            <label style={{ marginRight: 12 }}>
              <input
                type="radio"
                name="buffer-type"
                value="circular"
                checked={sampleBufferType === 'circular'}
                onChange={() => setSampleBufferType('circular')}
                disabled={isLoading}
              />{' '}
              Circular (default)
            </label>
            <label>
              <input
                type="radio"
                name="buffer-type"
                value="fifo"
                checked={sampleBufferType === 'fifo'}
                onChange={() => setSampleBufferType('fifo')}
                disabled={isLoading}
              />{' '}
              Fifo
            </label>
          </fieldset>
        ) : null}

        {showInterpolationStrategy ? (
          <fieldset
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 6,
              gridColumn: 'span 3',
            }}
          >
            <legend>Interpolation strategy</legend>
            {INTERPOLATION_STRATEGY_OPTIONS.map((option) => (
              <label key={option.value} style={{ marginRight: 12 }}>
                <input
                  type="radio"
                  name="interpolation-strategy"
                  value={option.value}
                  checked={interpolationStrategy === option.value}
                  onChange={() => setInterpolationStrategy(option.value)}
                  disabled={isLoading}
                />{' '}
                {option.label}
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        {sourceMode === 'element' ? (
          <audio
            key={selectedTrackId}
            ref={renderedElementRef}
            controls
            preload="auto"
            src={selectedTrack.url}
            style={{ width: '100%' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => void togglePlayback()}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
          </button>
        )}
      </div>

      {sourceMode === 'buffer' ? (
        <div style={{ marginTop: '0.75rem' }}>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={duration > 0 ? currentTime : 0}
            onChange={(event) => {
              void handleSeek(Number(event.target.value));
            }}
            disabled={duration <= 0 || isLoading}
            style={{ width: '100%' }}
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
      ) : null}

      <p style={{ marginBottom: 0, marginTop: '0.75rem', color: '#374151' }}>
        {status}
      </p>

      <div style={{ marginTop: '1rem' }}>
        <strong>TypeScript example</strong>
        <pre
          style={{
            marginTop: '0.5rem',
            background: '#f3f4f6',
            padding: '0.75rem',
            borderRadius: 8,
            overflowX: 'auto',
          }}
        >
          <code>{codeSample}</code>
        </pre>
      </div>

      <p style={{ marginTop: '0.75rem', color: '#1f2937' }}>{explanation}</p>
    </div>
  );
}
