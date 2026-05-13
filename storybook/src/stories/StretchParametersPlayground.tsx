import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import type { StretchParameters } from '@soundtouchjs/core';
import {
  type JSX,
  useCallback,
  useEffect,
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

const TRACKS: readonly AudioTrack[] = [
  { id: 'actionable', label: 'Bensound Actionable', url: actionableTrack },
  { id: 'downtown', label: 'Bensound Downtown', url: downtownTrack },
  { id: 'happiness', label: 'Bensound Happiness', url: happinessTrack },
  { id: 'hipjazz', label: 'Bensound Hip Jazz', url: hipjazzTrack },
  { id: 'retrosoul', label: 'Bensound Retro Soul', url: retrosoulTrack },
];

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds - minutes * 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function RangeControl({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
  listId,
  ticks,
  disabled,
}: {
  readonly label: string;
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly listId: string;
  readonly ticks: ReadonlyArray<number>;
  readonly disabled: boolean;
}): JSX.Element {
  return (
    <div>
      <label style={{ display: 'block' }}>
        <span style={{ fontWeight: 500 }}>{label}:</span>{' '}
        {value === 0 ? <em>auto</em> : `${value} ms`}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          list={listId}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          style={{ display: 'block', width: '100%' }}
        />
        <datalist id={listId}>
          {ticks.map((t) => (
            <option key={t} value={t} label={String(t)} />
          ))}
        </datalist>
      </label>
      <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
        {hint}
      </p>
    </div>
  );
}

export interface StretchParametersPlaygroundProps {
  readonly initialPitchSemitones?: number;
  readonly initialSequenceMs?: number;
  readonly initialSeekWindowMs?: number;
  readonly initialOverlapMs?: number;
  readonly initialQuickSeek?: boolean;
}

/** Interactive playground for SoundTouchNode.setStretchParameters() applied live during playback. */
export function StretchParametersPlayground({
  initialPitchSemitones = 5,
  initialSequenceMs = 0,
  initialSeekWindowMs = 0,
  initialOverlapMs = 8,
  initialQuickSeek = true,
}: StretchParametersPlaygroundProps): JSX.Element {
  const [selectedTrackId, setSelectedTrackId] = useState(TRACKS[0].id);
  const [pitchSemitones, setPitchSemitones] = useState(initialPitchSemitones);
  const [sequenceMs, setSequenceMs] = useState(initialSequenceMs);
  const [seekWindowMs, setSeekWindowMs] = useState(initialSeekWindowMs);
  const [overlapMs, setOverlapMs] = useState(initialOverlapMs);
  const [quickSeek, setQuickSeek] = useState(initialQuickSeek);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Idle');

  const audioContextRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<SoundTouchNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startAtContextTimeRef = useRef(0);
  const sourceOffsetRef = useRef(0);
  const rafIdRef = useRef(0);
  const isPlaybackActiveRef = useRef(false);
  const durationRef = useRef(duration);
  const pitchSemitonesRef = useRef(pitchSemitones);

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
    if (audioContextRef.current) await audioContextRef.current.close();
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
    await SoundTouchNode.register(context, processorModuleUrl);
    await SoundTouchNode.registerStrategyModule(
      context,
      interpolationStrategiesInstallerUrl,
    );
    const node = new SoundTouchNode({ context });
    node.connect(context.destination);
    audioContextRef.current = context;
    nodeRef.current = node;
  }, []);

  const syncParameters = useCallback(
    (params: {
      pitchSemitones: number;
      sequenceMs: number;
      seekWindowMs: number;
      overlapMs: number;
      quickSeek: boolean;
    }): void => {
      if (!nodeRef.current) return;
      nodeRef.current.pitchSemitones.value = params.pitchSemitones;
      nodeRef.current.setStretchParameters({
        sequenceMs: params.sequenceMs,
        seekWindowMs: params.seekWindowMs,
        overlapMs: params.overlapMs,
        quickSeek: params.quickSeek,
      } satisfies StretchParameters);
    },
    [],
  );

  const initializeTrack = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setStatus(`Loading ${selectedTrack.label}...`);
    try {
      await teardownGraph();
      await createGraph();
      const response = await fetch(selectedTrack.url);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer =
        await audioContextRef.current!.decodeAudioData(arrayBuffer);
      audioBufferRef.current = decodedBuffer;
      setDuration(decodedBuffer.duration);
      setCurrentTime(0);
      sourceOffsetRef.current = 0;
      setStatus(`Loaded ${selectedTrack.label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [createGraph, selectedTrack.label, selectedTrack.url, teardownGraph]);

  const tick = useCallback((): void => {
    if (!isPlaybackActiveRef.current) return;
    const context = audioContextRef.current;
    if (!context) return;
    const elapsed =
      sourceOffsetRef.current +
      (context.currentTime - startAtContextTimeRef.current);
    const nextTime = Math.min(elapsed, durationRef.current);
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
      if (!audioContextRef.current || !nodeRef.current || !audioBufferRef.current)
        return;
      clearSourceNode();
      await audioContextRef.current.resume();
      syncParameters({
        pitchSemitones: pitchSemitonesRef.current,
        sequenceMs,
        seekWindowMs,
        overlapMs,
        quickSeek,
      });
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
    [clearSourceNode, syncParameters, sequenceMs, seekWindowMs, overlapMs, quickSeek, tick],
  );

  const startPlayback = useCallback(async (): Promise<void> => {
    if (!audioContextRef.current || !audioBufferRef.current || !nodeRef.current) {
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
    if (isPlaying) await beginPlaybackFromOffset(bounded);
  };

  // Sync pitchSemitones to node immediately on change
  useEffect(() => {
    pitchSemitonesRef.current = pitchSemitones;
    if (nodeRef.current) nodeRef.current.pitchSemitones.value = pitchSemitones;
  }, [pitchSemitones]);

  // Sync stretch parameters to node immediately on change
  useEffect(() => {
    if (nodeRef.current) {
      nodeRef.current.setStretchParameters({
        sequenceMs,
        seekWindowMs,
        overlapMs,
        quickSeek,
      });
    }
  }, [sequenceMs, seekWindowMs, overlapMs, quickSeek]);

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
      <h3 style={{ marginTop: 0 }}>WSOLA Stretch Parameters Playground</h3>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Adjust the WSOLA timing parameters in real time during playback.{' '}
        <code>sequenceMs</code> and <code>seekWindowMs</code> both default to{' '}
        <strong>auto</strong> (value&nbsp;0). Increase them to hear longer
        processing windows or tighter seek regions. <code>overlapMs</code>{' '}
        controls the crossfade length; <code>quickSeek</code> toggles between
        fast multi-pass and exhaustive best-overlap search.
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
            {TRACKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 500 }}>Pitch semitones:</span>{' '}
            {pitchSemitones}
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={pitchSemitones}
              onChange={(e) => setPitchSemitones(Number(e.target.value))}
              disabled={isLoading}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
            Pitch shift in semitones (positive = higher, negative = lower)
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          marginTop: '0.75rem',
          padding: '0.75rem',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background: '#f9fafb',
        }}
      >
        <div
          style={{
            gridColumn: '1 / -1',
            fontWeight: 600,
            fontSize: '0.875rem',
            marginBottom: '0.25rem',
            color: '#374151',
          }}
        >
          WSOLA timing parameters (applied live)
        </div>

        <RangeControl
          label="sequenceMs"
          hint="Processing window length. 0 = auto (algorithm selects ~50–125 ms based on tempo)."
          min={0}
          max={200}
          step={1}
          value={sequenceMs}
          onChange={setSequenceMs}
          listId="seq-ms-ticks"
          ticks={[0, 40, 80, 120, 160, 200]}
          disabled={isLoading}
        />

        <RangeControl
          label="seekWindowMs"
          hint="Seek window for best-overlap search. 0 = auto (algorithm selects ~15–25 ms)."
          min={0}
          max={100}
          step={1}
          value={seekWindowMs}
          onChange={setSeekWindowMs}
          listId="seek-ms-ticks"
          ticks={[0, 15, 30, 50, 75, 100]}
          disabled={isLoading}
        />

        <RangeControl
          label="overlapMs"
          hint="Crossfade length between successive output segments. Default 8 ms."
          min={4}
          max={32}
          step={1}
          value={overlapMs}
          onChange={(v) => {
            // overlapMs 0 has special meaning (keep existing) so floor at 4
            setOverlapMs(Math.max(4, v));
          }}
          listId="overlap-ms-ticks"
          ticks={[4, 8, 12, 16, 24, 32]}
          disabled={isLoading}
        />

        <div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={quickSeek}
              onChange={(e) => setQuickSeek(e.target.checked)}
              disabled={isLoading}
            />
            quickSeek
          </label>
          <p
            style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}
          >
            Checked (default): fast multi-pass best-overlap scan. Unchecked:
            exhaustive search — more accurate, higher CPU.
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
          onChange={(e) => void handleSeek(Number(e.target.value))}
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
          <code>{`import { SoundTouchNode } from '@soundtouchjs/audio-worklet';

const node = new SoundTouchNode({ context });

// Apply WSOLA timing at any time — takes effect on the next render block.
node.setStretchParameters({
  sequenceMs: ${sequenceMs || 0},     // 0 = auto
  seekWindowMs: ${seekWindowMs || 0}, // 0 = auto
  overlapMs: ${overlapMs},
  quickSeek: ${String(quickSeek)},
});`}</code>
        </pre>
      </div>
    </div>
  );
}
