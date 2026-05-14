import { processOffline } from '@soundtouchjs/audio-worklet';
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

const PITCH_SEMITONE_TICKS = [-12, -7, -5, 0, 5, 7, 12];
const RATE_TICKS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds - minutes * 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export interface ProcessOfflinePlaygroundProps {
  readonly initialPitchSemitones?: number;
  readonly initialPlaybackRate?: number;
}

/** Interactive playground demonstrating processOffline() with selectable tracks, pitch, rate, and stretch parameters. */
export function ProcessOfflinePlayground({
  initialPitchSemitones = 5,
  initialPlaybackRate = 1,
}: ProcessOfflinePlaygroundProps): JSX.Element {
  const [selectedTrackId, setSelectedTrackId] = useState(TRACKS[0].id);
  const [pitchSemitones, setPitchSemitones] = useState(initialPitchSemitones);
  const [playbackRate, setPlaybackRate] = useState(initialPlaybackRate);
  const [overlapMs, setOverlapMs] = useState(8);
  const [quickSeek, setQuickSeek] = useState(true);

  // Render state
  const [isRendering, setIsRendering] = useState(false);
  const [renderDuration, setRenderDuration] = useState<number | null>(null);
  const [renderedBuffer, setRenderedBuffer] = useState<AudioBuffer | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [status, setStatus] = useState('Configure parameters and click Render.');

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const rafIdRef = useRef(0);
  const isPlaybackActiveRef = useRef(false);
  const startAtContextTimeRef = useRef(0);
  const sourceOffsetRef = useRef(0);
  const renderedDurationRef = useRef(0);

  const selectedTrack =
    TRACKS.find((t) => t.id === selectedTrackId) ?? TRACKS[0];

  const stopPlayback = useCallback((): void => {
    isPlaybackActiveRef.current = false;
    window.cancelAnimationFrame(rafIdRef.current);
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    sourceOffsetRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const teardownAudioContext = useCallback(async (): Promise<void> => {
    stopPlayback();
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [stopPlayback]);

  // Reset rendered buffer when track selection or params change
  const handleParamChange = useCallback((): void => {
    stopPlayback();
    setRenderedBuffer(null);
    setRenderDuration(null);
    setStatus('Parameters changed — click Render to process.');
  }, [stopPlayback]);

  const handleRender = useCallback(async (): Promise<void> => {
    if (isRendering) return;
    setIsRendering(true);
    stopPlayback();
    setRenderedBuffer(null);
    setRenderDuration(null);
    setStatus(`Fetching ${selectedTrack.label}...`);

    try {
      // Fetch + decode source
      const response = await fetch(selectedTrack.url);
      const arrayBuffer = await response.arrayBuffer();
      const tmpCtx = new AudioContext();
      const sourceBuffer = await tmpCtx.decodeAudioData(arrayBuffer);
      await tmpCtx.close();

      const stretchParameters: StretchParameters = {
        overlapMs,
        quickSeek,
      };

      setStatus('Rendering offline…');
      const t0 = performance.now();

      const outputBuffer = await processOffline({
        input: sourceBuffer,
        processorUrl: processorModuleUrl,
        pitchSemitones,
        playbackRate,
        stretchParameters,
      });

      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      setRenderDuration(Number(elapsed));
      setRenderedBuffer(outputBuffer);
      renderedDurationRef.current = outputBuffer.duration;
      setStatus(
        `Rendered in ${elapsed}s — output ${formatTime(outputBuffer.duration)} (${outputBuffer.numberOfChannels}ch @ ${outputBuffer.sampleRate} Hz). Press Play.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Render error: ${message}`);
    } finally {
      setIsRendering(false);
    }
  }, [
    isRendering,
    selectedTrack,
    pitchSemitones,
    playbackRate,
    overlapMs,
    quickSeek,
    stopPlayback,
  ]);

  const tick = useCallback((): void => {
    if (!isPlaybackActiveRef.current) return;
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const elapsed =
      sourceOffsetRef.current +
      (ctx.currentTime - startAtContextTimeRef.current);
    setCurrentTime(Math.min(elapsed, renderedDurationRef.current));
    if (elapsed >= renderedDurationRef.current) {
      isPlaybackActiveRef.current = false;
      setIsPlaying(false);
      setStatus('Playback complete.');
      return;
    }
    rafIdRef.current = window.requestAnimationFrame(tick);
  }, []);

  const startPlayback = useCallback(async (): Promise<void> => {
    if (!renderedBuffer) return;
    stopPlayback();

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    await audioContextRef.current.resume();

    const source = audioContextRef.current.createBufferSource();
    source.buffer = renderedBuffer;
    source.connect(audioContextRef.current.destination);
    sourceNodeRef.current = source;
    sourceOffsetRef.current = 0;
    startAtContextTimeRef.current = audioContextRef.current.currentTime;
    source.start(0);
    source.onended = () => {
      isPlaybackActiveRef.current = false;
      setIsPlaying(false);
    };
    isPlaybackActiveRef.current = true;
    setIsPlaying(true);
    setStatus('Playing rendered output…');
    rafIdRef.current = window.requestAnimationFrame(tick);
  }, [renderedBuffer, stopPlayback, tick]);

  const togglePlayback = useCallback(async (): Promise<void> => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    await startPlayback();
  }, [isPlaying, startPlayback, stopPlayback]);

  // Invalidate rendered buffer when any parameter changes
  useEffect(() => {
    handleParamChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrackId, pitchSemitones, playbackRate, overlapMs, quickSeek]);

  useEffect(() => {
    renderedDurationRef.current = renderedBuffer?.duration ?? 0;
  }, [renderedBuffer]);

  useEffect(() => {
    return () => {
      void teardownAudioContext();
    };
  }, [teardownAudioContext]);

  const estimatedOutputSeconds =
    renderedBuffer?.duration ??
    null;

  return (
    <div
      style={{
        maxWidth: 860,
        padding: '1rem',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <h3 style={{ marginTop: 0 }}>processOffline() Playground</h3>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Configure pitch and playback rate, then click <strong>Render</strong>.{' '}
        The entire track is processed in an <code>OfflineAudioContext</code> —
        no live audio graph. Once rendering finishes you can play the result
        directly from the rendered <code>AudioBuffer</code>.
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
            disabled={isRendering}
            style={{ display: 'block', width: '100%' }}
          >
            {TRACKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'block' }}>
          Pitch semitones: {pitchSemitones}
          <input
            type="range"
            min={-12}
            max={12}
            step={1}
            value={pitchSemitones}
            list="offline-pitch-ticks"
            onChange={(e) => setPitchSemitones(Number(e.target.value))}
            disabled={isRendering}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id="offline-pitch-ticks">
            {PITCH_SEMITONE_TICKS.map((v) => (
              <option key={v} value={v} label={String(v)} />
            ))}
          </datalist>
        </label>

        <label style={{ display: 'block' }}>
          Playback rate:{' '}
          {Number.isInteger(playbackRate)
            ? playbackRate
            : playbackRate.toFixed(2)}
          x
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={playbackRate}
            list="offline-rate-ticks"
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            disabled={isRendering}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id="offline-rate-ticks">
            {RATE_TICKS.map((v) => (
              <option key={v} value={v} label={String(v)} />
            ))}
          </datalist>
        </label>
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
            color: '#374151',
            marginBottom: '0.25rem',
          }}
        >
          Stretch parameters (passed to stretchParameters option)
        </div>

        <label style={{ display: 'block' }}>
          overlapMs: {overlapMs} ms
          <input
            type="range"
            min={4}
            max={32}
            step={1}
            value={overlapMs}
            list="offline-overlap-ticks"
            onChange={(e) => setOverlapMs(Number(e.target.value))}
            disabled={isRendering}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id="offline-overlap-ticks">
            {[4, 8, 12, 16, 24, 32].map((v) => (
              <option key={v} value={v} label={String(v)} />
            ))}
          </datalist>
        </label>

        <div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={quickSeek}
              onChange={(e) => setQuickSeek(e.target.checked)}
              disabled={isRendering}
            />
            quickSeek
          </label>
          <p
            style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}
          >
            Unchecked = exhaustive best-overlap search (slower render, higher
            quality)
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => void handleRender()}
          disabled={isRendering}
          style={{ fontWeight: 600 }}
        >
          {isRendering ? 'Rendering…' : 'Render'}
        </button>

        {renderedBuffer && (
          <button
            type="button"
            onClick={() => void togglePlayback()}
            disabled={isRendering}
          >
            {isPlaying ? 'Stop' : 'Play rendered output'}
          </button>
        )}

        {renderDuration !== null && (
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            rendered in {renderDuration}s
          </span>
        )}
      </div>

      {renderedBuffer && (
        <div style={{ marginTop: '0.75rem' }}>
          <input
            type="range"
            min={0}
            max={estimatedOutputSeconds ?? 0}
            step={0.01}
            value={currentTime}
            disabled
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
            <span>{formatTime(renderedBuffer.duration)}</span>
          </div>
        </div>
      )}

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
          <code>{`import { processOffline } from '@soundtouchjs/audio-worklet';
import processorUrl from '@soundtouchjs/audio-worklet/processor?url';

const response = await fetch('${selectedTrack.url}');
const arrayBuffer = await response.arrayBuffer();
const audioCtx = new AudioContext();
const sourceBuffer = await audioCtx.decodeAudioData(arrayBuffer);

const rendered = await processOffline({
  input: sourceBuffer,
  processorUrl,
  pitchSemitones: ${pitchSemitones},
  playbackRate: ${playbackRate.toFixed(2)},
  stretchParameters: { overlapMs: ${overlapMs}, quickSeek: ${String(quickSeek)} },
});

// Play or export the result
const source = audioCtx.createBufferSource();
source.buffer = rendered;
source.connect(audioCtx.destination);
source.start();`}</code>
        </pre>
      </div>
    </div>
  );
}
