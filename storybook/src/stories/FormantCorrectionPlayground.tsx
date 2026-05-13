import { FormantCorrectionNode } from '@soundtouchjs/formant-correction-worklet';
import type {
  RateTransposerInterpolationStrategy,
  SampleBufferType,
} from '@soundtouchjs/core';
import {
  type JSX,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import processorModuleUrl from '../../../packages/formant-correction-worklet/src/formant-correction-processor.ts?url';
import actionableTrack from '../../../apps/demo/public/bensound-actionable.mp3?url';
import downtownTrack from '../../../apps/demo/public/bensound-downtown.mp3?url';
import happinessTrack from '../../../apps/demo/public/bensound-happiness.mp3?url';
import hipjazzTrack from '../../../apps/demo/public/bensound-hipjazz.mp3?url';
import retrosoulTrack from '../../../apps/demo/public/bensound-retrosoul.mp3?url';

interface AudioTrack {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

interface DatalistTick {
  readonly value: number;
  readonly label: string;
}

const TRACKS: readonly AudioTrack[] = [
  { id: 'actionable', label: 'Bensound Actionable', url: actionableTrack },
  { id: 'downtown', label: 'Bensound Downtown', url: downtownTrack },
  { id: 'happiness', label: 'Bensound Happiness', url: happinessTrack },
  { id: 'hipjazz', label: 'Bensound Hip Jazz', url: hipjazzTrack },
  { id: 'retrosoul', label: 'Bensound Retro Soul', url: retrosoulTrack },
];

const PITCH_SEMITONE_TICKS: readonly DatalistTick[] = [
  { value: -12, label: '-12' },
  { value: -7, label: '-7' },
  { value: -5, label: '-5' },
  { value: 0, label: '0' },
  { value: 5, label: '5' },
  { value: 7, label: '7' },
  { value: 12, label: '12' },
];

const FORMANT_STRENGTH_TICKS: readonly DatalistTick[] = [
  { value: 0, label: '0' },
  { value: 0.25, label: '0.25' },
  { value: 0.5, label: '0.5' },
  { value: 0.75, label: '0.75' },
  { value: 1, label: '1' },
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

export interface FormantCorrectionPlaygroundProps {
  readonly initialFormantStrength?: number;
  readonly initialPitchSemitones?: number;
  readonly sampleBufferType?: SampleBufferType;
  readonly interpolationStrategy?: RateTransposerInterpolationStrategy;
}

/** Interactive playground for FormantCorrectionNode with formantStrength A/B toggle. */
export function FormantCorrectionPlayground({
  initialFormantStrength = 1,
  initialPitchSemitones = 7,
  sampleBufferType = 'circular',
  interpolationStrategy = 'lanczos',
}: FormantCorrectionPlaygroundProps): JSX.Element {
  const [selectedTrackId, setSelectedTrackId] = useState(TRACKS[0].id);
  const [pitchSemitones, setPitchSemitones] = useState(initialPitchSemitones);
  const [formantStrength, setFormantStrength] = useState(initialFormantStrength);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Idle');

  const audioContextRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<FormantCorrectionNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startAtContextTimeRef = useRef(0);
  const sourceOffsetRef = useRef(0);
  const rafIdRef = useRef(0);
  const isPlaybackActiveRef = useRef(false);
  const pitchSemitonesRef = useRef(pitchSemitones);
  const formantStrengthRef = useRef(formantStrength);
  const durationRef = useRef(duration);

  const selectedTrack =
    TRACKS.find((t) => t.id === selectedTrackId) ?? TRACKS[0];

  const clearSourceNode = useCallback((): void => {
    if (!sourceNodeRef.current) return;
    sourceNodeRef.current.onended = null;
    sourceNodeRef.current.stop();
    sourceNodeRef.current.disconnect();
    sourceNodeRef.current = null;
  }, []);

  const teardownGraph = useCallback(async (): Promise<void> => {
    isPlaybackActiveRef.current = false;
    window.cancelAnimationFrame(rafIdRef.current);
    clearSourceNode();
    if (audioContextRef.current) {
      await audioContextRef.current.close();
    }
    audioContextRef.current = null;
    nodeRef.current = null;
    audioBufferRef.current = null;
    sourceOffsetRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [clearSourceNode]);

  const createGraph = useCallback(async (): Promise<void> => {
    const context = new AudioContext();
    await FormantCorrectionNode.register(context, processorModuleUrl);

    const node = new FormantCorrectionNode({
      context,
      sampleBufferType,
      interpolationStrategy,
    });
    node.connect(context.destination);

    audioContextRef.current = context;
    nodeRef.current = node;
  }, [interpolationStrategy, sampleBufferType]);

  const syncNodeParameters = useCallback((): void => {
    if (!nodeRef.current) return;
    nodeRef.current.pitchSemitones.value = pitchSemitonesRef.current;
    nodeRef.current.formantStrength.value = formantStrengthRef.current;
  }, []);

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

  const initializeTrack = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setStatus(`Loading ${selectedTrack.label}...`);
    try {
      await teardownGraph();
      await createGraph();
      await loadTrackBuffer();
      setStatus(`Loaded ${selectedTrack.label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [createGraph, loadTrackBuffer, selectedTrack.label, teardownGraph]);

  const tick = useCallback((): void => {
    if (!isPlaybackActiveRef.current) return;
    const context = audioContextRef.current;
    if (!context) return;

    const elapsed =
      sourceOffsetRef.current +
      (context.currentTime - startAtContextTimeRef.current);
    const nextTime =
      elapsed >= durationRef.current ? durationRef.current : elapsed;
    setCurrentTime(nextTime);

    if (elapsed >= durationRef.current) {
      isPlaybackActiveRef.current = false;
      setIsPlaying(false);
      setStatus('Playback complete');
      return;
    }
    rafIdRef.current = window.requestAnimationFrame(tick);
  }, []);

  const beginPlaybackFromOffset = useCallback(
    async (offset: number): Promise<void> => {
      if (
        !audioContextRef.current ||
        !nodeRef.current ||
        !audioBufferRef.current
      )
        return;

      clearSourceNode();
      await audioContextRef.current.resume();
      syncNodeParameters();

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(nodeRef.current);
      sourceNodeRef.current = source;
      sourceOffsetRef.current = offset;
      startAtContextTimeRef.current = audioContextRef.current.currentTime;

      source.start(0, offset);
      source.onended = () => {
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
    if (
      !audioContextRef.current ||
      !audioBufferRef.current ||
      !nodeRef.current
    ) {
      await initializeTrack();
    }
    await beginPlaybackFromOffset(sourceOffsetRef.current);
  }, [beginPlaybackFromOffset, initializeTrack]);

  const stopPlayback = useCallback((): void => {
    isPlaybackActiveRef.current = false;
    window.cancelAnimationFrame(rafIdRef.current);
    clearSourceNode();
    sourceOffsetRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    setStatus('Stopped');
  }, [clearSourceNode]);

  const togglePlayback = useCallback(async (): Promise<void> => {
    if (isLoading) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }
    await startPlayback();
  }, [isLoading, isPlaying, startPlayback, stopPlayback]);

  const handleSeek = async (nextTime: number): Promise<void> => {
    if (duration <= 0) return;
    const bounded = Math.min(duration, Math.max(0, nextTime));
    sourceOffsetRef.current = bounded;
    setCurrentTime(bounded);
    if (isPlaying) {
      await beginPlaybackFromOffset(bounded);
    }
  };

  useEffect(() => {
    pitchSemitonesRef.current = pitchSemitones;
    if (nodeRef.current) {
      nodeRef.current.pitchSemitones.value = pitchSemitones;
    }
  }, [pitchSemitones]);

  useEffect(() => {
    formantStrengthRef.current = formantStrength;
    if (nodeRef.current) {
      nodeRef.current.formantStrength.value = formantStrength;
    }
  }, [formantStrength]);

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

  const abLabel =
    formantStrength >= 0.5 ? 'B: Formant corrected' : 'A: Raw pitch shift';

  return (
    <div
      style={{
        maxWidth: 860,
        padding: '1rem',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Formant Correction Playground</h3>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Pitch-shift audio with and without formant correction. Shift the pitch
        semitones up or down, then drag <strong>Formant Strength</strong> between
        0 (raw — chipmunk/giant effect) and 1 (corrected — natural timbre
        preserved). The A/B toggle snaps to either extreme for quick comparison.
      </p>

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
            onChange={(e) => setSelectedTrackId(e.target.value)}
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

        <RangeControl
          label="Pitch semitones"
          min={-24}
          max={24}
          step={1}
          value={pitchSemitones}
          onChange={setPitchSemitones}
          ticks={PITCH_SEMITONE_TICKS}
          listId="formant-pitch-semitone-ticks"
          disabled={isLoading}
        />

        <RangeControl
          label="Formant Strength"
          min={0}
          max={1}
          step={0.01}
          value={formantStrength}
          onChange={setFormantStrength}
          ticks={FORMANT_STRENGTH_TICKS}
          listId="formant-strength-ticks"
          disabled={isLoading}
        />

        <div style={{ alignSelf: 'end' }}>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
            }}
          >
            <button
              type="button"
              onClick={() => setFormantStrength(0)}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '0.4rem 0.75rem',
                background: formantStrength === 0 ? '#1d4ed8' : '#e5e7eb',
                color: formantStrength === 0 ? '#fff' : '#374151',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              A: Raw
            </button>
            <button
              type="button"
              onClick={() => setFormantStrength(1)}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '0.4rem 0.75rem',
                background: formantStrength === 1 ? '#1d4ed8' : '#e5e7eb',
                color: formantStrength === 1 ? '#fff' : '#374151',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              B: Corrected
            </button>
          </div>
          <p
            style={{
              margin: '0.35rem 0 0',
              fontSize: '0.8rem',
              color: '#6b7280',
            }}
          >
            {abLabel}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={() => void togglePlayback()}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

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
          <code>{`import { FormantCorrectionNode } from '@soundtouchjs/formant-correction-worklet';
import processorUrl from '@soundtouchjs/formant-correction-worklet/processor?url';

const audioCtx = new AudioContext();
await FormantCorrectionNode.register(audioCtx, processorUrl);

const node = new FormantCorrectionNode({ context: audioCtx });

// Shift up a perfect fifth; keep original vocal timbre
node.pitchSemitones.value = 7;
node.formantStrength.value = 1;

node.connect(audioCtx.destination);
sourceNode.connect(node);

// A/B toggle
abButton.addEventListener('click', () => {
  node.formantStrength.value = node.formantStrength.value > 0.5 ? 0 : 1;
});`}</code>
        </pre>
      </div>

      <p style={{ marginTop: '0.75rem', color: '#1f2937' }}>
        At <code>formantStrength = 0</code> the output is identical to a plain{' '}
        <code>SoundTouchNode</code> — the "chipmunk" or "giant" effect is fully
        present. Increasing towards <code>1</code> progressively re-applies the
        original voice formant envelope, keeping the speaker's natural timbre
        even at large pitch shifts. The LPC computation adds a small per-block
        CPU cost, so use <code>SoundTouchNode</code> for instruments where
        formant correction is unnecessary.
      </p>
    </div>
  );
}
