import { PhaseVocoderNode } from '@soundtouchjs/phase-vocoder-worklet';
import type { PhaseVocoderFftSize, PhaseVocoderOverlapFactor } from '@soundtouchjs/stretch-phase-vocoder';
import {
  type JSX,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import processorModuleUrl from '../../../packages/phase-vocoder-worklet/src/phase-vocoder-processor.ts?worker&url';
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

const TRACKS: readonly AudioTrack[] = [
  { id: 'actionable', label: 'Bensound Actionable', url: actionableTrack },
  { id: 'downtown', label: 'Bensound Downtown', url: downtownTrack },
  { id: 'happiness', label: 'Bensound Happiness', url: happinessTrack },
  { id: 'hipjazz', label: 'Bensound Hip Jazz', url: hipjazzTrack },
  { id: 'retrosoul', label: 'Bensound Retro Soul', url: retrosoulTrack },
];

const FFT_SIZES: readonly PhaseVocoderFftSize[] = [512, 1024, 2048, 4096];
const OVERLAP_FACTORS: readonly PhaseVocoderOverlapFactor[] = [2, 4, 8];

const PITCH_SEMITONE_TICKS = [-24, -12, -7, -5, 0, 5, 7, 12, 24];

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds - minutes * 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function ToggleGroup<T extends number>({
  label,
  options,
  value,
  onChange,
  disabled,
  formatOption,
}: {
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly onChange: (v: T) => void;
  readonly disabled: boolean;
  readonly formatOption?: (v: T) => string;
}): JSX.Element {
  return (
    <div>
      <div style={{ fontWeight: 500, marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            disabled={disabled}
            style={{
              padding: '0.3rem 0.65rem',
              background: value === opt ? '#1d4ed8' : '#e5e7eb',
              color: value === opt ? '#fff' : '#374151',
              border: 'none',
              borderRadius: 6,
              cursor: disabled ? 'default' : 'pointer',
              fontWeight: value === opt ? 600 : 400,
              fontSize: '0.875rem',
            }}
          >
            {formatOption ? formatOption(opt) : String(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface PhaseVocoderPlaygroundProps {
  readonly initialPitchSemitones?: number;
  readonly initialFftSize?: PhaseVocoderFftSize;
  readonly initialOverlapFactor?: PhaseVocoderOverlapFactor;
}

/** Interactive playground for PhaseVocoderNode demonstrating fftSize and overlapFactor tradeoffs. */
export function PhaseVocoderPlayground({
  initialPitchSemitones = 5,
  initialFftSize = 2048,
  initialOverlapFactor = 4,
}: PhaseVocoderPlaygroundProps): JSX.Element {
  const [selectedTrackId, setSelectedTrackId] = useState(TRACKS[0].id);
  const [pitchSemitones, setPitchSemitones] = useState(initialPitchSemitones);
  const [fftSize, setFftSize] = useState<PhaseVocoderFftSize>(initialFftSize);
  const [overlapFactor, setOverlapFactor] = useState<PhaseVocoderOverlapFactor>(initialOverlapFactor);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [metrics, setMetrics] = useState<ProcessorMetrics | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<PhaseVocoderNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startAtContextTimeRef = useRef(0);
  const sourceOffsetRef = useRef(0);
  const rafIdRef = useRef(0);
  const isPlaybackActiveRef = useRef(false);
  const pitchSemitonesRef = useRef(pitchSemitones);
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
    setMetrics(null);
  }, [clearSourceNode]);

  const createGraph = useCallback(
    async (ctx: AudioContext): Promise<void> => {
      await PhaseVocoderNode.register(ctx, processorModuleUrl);
      const node = new PhaseVocoderNode({
        context: ctx,
        fftSize,
        overlapFactor,
      });
      node.connect(ctx.destination);
      node.addEventListener('metrics', (e: Event) => {
        setMetrics((e as CustomEvent<ProcessorMetrics>).detail);
      });
      nodeRef.current = node;
    },
    [fftSize, overlapFactor],
  );

  const loadTrackBuffer = useCallback(
    async (ctx: AudioContext): Promise<void> => {
      const response = await fetch(selectedTrack.url);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBufferRef.current = decodedBuffer;
      setDuration(decodedBuffer.duration);
      setCurrentTime(0);
      sourceOffsetRef.current = 0;
    },
    [selectedTrack.url],
  );

  const initializeTrack = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setStatus(`Loading ${selectedTrack.label}...`);
    try {
      await teardownGraph();
      const context = new AudioContext();
      audioContextRef.current = context;
      await createGraph(context);
      await loadTrackBuffer(context);
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
      if (
        !audioContextRef.current ||
        !nodeRef.current ||
        !audioBufferRef.current
      )
        return;

      clearSourceNode();
      await audioContextRef.current.resume();

      if (nodeRef.current) {
        nodeRef.current.pitchSemitones.value = pitchSemitonesRef.current;
      }

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
    [clearSourceNode, tick],
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

  const ha = fftSize / overlapFactor;
  const latencyMs = Math.round((fftSize / 44100) * 1000);

  return (
    <div
      style={{
        maxWidth: 860,
        padding: '1rem',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Phase Vocoder Playground</h3>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Pitch-shift audio using the phase vocoder algorithm. Adjust{' '}
        <strong>FFT size</strong> (frequency resolution vs. latency) and{' '}
        <strong>Overlap factor</strong> (smoothness vs. CPU). Changing either
        option rebuilds the audio graph — stop playback first for a clean
        transition.
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

        <div>
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 500 }}>Pitch semitones:</span>{' '}
            {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones}
            <input
              type="range"
              min={-24}
              max={24}
              step={1}
              value={pitchSemitones}
              list="pv-pitch-ticks"
              onChange={(e) => setPitchSemitones(Number(e.target.value))}
              disabled={isLoading}
              style={{ display: 'block', width: '100%' }}
            />
            <datalist id="pv-pitch-ticks">
              {PITCH_SEMITONE_TICKS.map((v) => (
                <option key={v} value={v} label={String(v)} />
              ))}
            </datalist>
          </label>
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
        <div style={{ gridColumn: '1 / -1', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
          Phase vocoder parameters (rebuilds graph on change)
        </div>

        <div>
          <ToggleGroup
            label="FFT size"
            options={FFT_SIZES}
            value={fftSize}
            onChange={setFftSize}
            disabled={isLoading}
          />
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
            Larger = better frequency resolution, higher latency (~{latencyMs} ms at {fftSize} samples / 44.1 kHz).
          </p>
        </div>

        <div>
          <ToggleGroup
            label="Overlap factor"
            options={OVERLAP_FACTORS}
            value={overlapFactor}
            onChange={setOverlapFactor}
            disabled={isLoading}
          />
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
            Higher = smoother output, more CPU. Analysis hop = {ha} samples ({Math.round((ha / 44100) * 1000)} ms).
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

      <div
        style={{
          marginTop: '0.75rem',
          padding: '0.5rem 0.75rem',
          background: '#f3f4f6',
          borderRadius: 6,
          fontSize: '0.8rem',
          color: '#374151',
          display: 'flex',
          gap: '1.5rem',
        }}
      >
        <span><strong>Buffered frames:</strong> {metrics?.framesBuffered ?? 0}</span>
        <span><strong>Underruns:</strong> {metrics?.underrunCount ?? 0}</span>
        <span><strong>Blocks processed:</strong> {metrics?.blockCount ?? 0}</span>
        <span><strong>Output RMS:</strong> {metrics?.outputRms !== undefined ? metrics.outputRms.toFixed(4) : '--'}</span>
        <span><strong>Peak:</strong> {metrics?.outputPeak !== undefined ? metrics.outputPeak.toFixed(4) : '--'}</span>
      </div>

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
          <code>{`import { PhaseVocoderNode } from '@soundtouchjs/phase-vocoder-worklet';
import processorUrl from '@soundtouchjs/phase-vocoder-worklet/processor?url';

const audioCtx = new AudioContext();
await PhaseVocoderNode.register(audioCtx, processorUrl);

const node = new PhaseVocoderNode({
  context: audioCtx,
  fftSize: ${fftSize},
  overlapFactor: ${overlapFactor},
});

node.pitchSemitones.value = ${pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones};
node.connect(audioCtx.destination);
sourceNode.connect(node);`}</code>
        </pre>
      </div>

      <p style={{ marginTop: '0.75rem', color: '#1f2937' }}>
        The phase vocoder maintains phase coherence across FFT bins, producing
        cleaner pitch shifts than WSOLA at extreme ratios (&gt; 1.5×) but with
        inherent latency equal to the FFT frame size. For real-time monitoring
        with low latency, prefer a smaller <code>fftSize</code>. For recorded
        material where quality matters more than delay, use a larger{' '}
        <code>fftSize</code> with a higher <code>overlapFactor</code>.
      </p>
    </div>
  );
}
