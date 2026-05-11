import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import { useCallback, useEffect, useRef, useState } from 'react';

import processorModuleUrl from '../../../../packages/audio-worklet/src/processor.ts?url';
import interpolationStrategiesInstallerUrl from '../../worklet/interpolation-strategies.installers.ts?url';

import actionableTrack from '/bensound-actionable.mp3?url';
import downtownTrack from '/bensound-downtown.mp3?url';
import happinessTrack from '/bensound-happiness.mp3?url';
import hipjazzTrack from '/bensound-hipjazz.mp3?url';
import retrosoulTrack from '/bensound-retrosoul.mp3?url';

const TRACKS = [
  { id: 'actionable', label: 'Bensound Actionable', url: actionableTrack },
  { id: 'downtown', label: 'Bensound Downtown', url: downtownTrack },
  { id: 'happiness', label: 'Bensound Happiness', url: happinessTrack },
  { id: 'hipjazz', label: 'Bensound Hip Jazz', url: hipjazzTrack },
  { id: 'retrosoul', label: 'Bensound Retro Soul', url: retrosoulTrack },
];

type RangeParamDef = { type?: 'range'; min: number; max: number; step: number; default: number };
type BooleanParamDef = { type: 'boolean'; default: boolean };
type SelectParamDef = { type: 'select'; options: string[]; default: string };
type ParamDef = RangeParamDef | BooleanParamDef | SelectParamDef;

interface InterpolationPlaygroundBaseProps {
  title: string;
  description: string;
  codeSample: string;
  explanation: string;
  params: Record<string, ParamDef>;
  strategyId: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds - m * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function ParamControl({
  paramKey,
  def,
  value,
  disabled,
  onChange,
}: {
  paramKey: string;
  def: ParamDef;
  value: number | boolean | string;
  disabled: boolean;
  onChange: (key: string, value: number | boolean | string) => void;
}) {
  if (def.type === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(paramKey, e.target.checked)}
          disabled={disabled}
        />
        {paramKey}
      </label>
    );
  }
  if (def.type === 'select') {
    return (
      <label style={{ display: 'block' }}>
        {paramKey}
        <select
          value={String(value)}
          onChange={(e) => onChange(paramKey, e.target.value)}
          disabled={disabled}
          style={{ display: 'block', width: '100%' }}
        >
          {def.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
    );
  }
  const listId = `datalist-param-${paramKey}`;
  const numVal = Number(value);
  return (
    <label style={{ display: 'block' }}>
      {paramKey}: {Number.isInteger(numVal) ? numVal : numVal.toFixed(2)}
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={numVal}
        list={listId}
        onChange={(e) => onChange(paramKey, Number(e.target.value))}
        disabled={disabled}
        style={{ display: 'block', width: '100%' }}
      />
      <datalist id={listId}>
        <option value={def.min} label={String(def.min)} />
        <option value={(def.min + def.max) / 2} label={String((def.min + def.max) / 2)} />
        <option value={def.max} label={String(def.max)} />
      </datalist>
    </label>
  );
}

export const InterpolationPlaygroundBase = ({
  title,
  description,
  codeSample,
  explanation,
  params,
  strategyId,
}: InterpolationPlaygroundBaseProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, number | boolean | string>>(
    Object.fromEntries(Object.entries(params).map(([key, def]) => [key, def.default]))
  );
  const [selectedTrackId, setSelectedTrackId] = useState(TRACKS[0].id);
  const [volume, setVolume] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [looped, setLooped] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const soundTouchNodeRef = useRef<SoundTouchNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const rafIdRef = useRef(0);
  const isActiveRef = useRef(false);
  const startAtContextTimeRef = useRef(0);
  const sourceOffsetRef = useRef(0);
  const loopedRef = useRef(looped);
  const durationRef = useRef(duration);
  const playbackRateRef = useRef(playbackRate);

  const selectedTrack = TRACKS.find((t) => t.id === selectedTrackId) ?? TRACKS[0];

  const clearSourceNode = useCallback(() => {
    if (!sourceNodeRef.current) return;
    sourceNodeRef.current.onended = null;
    sourceNodeRef.current.stop();
    sourceNodeRef.current.disconnect();
    sourceNodeRef.current = null;
  }, []);

  const teardown = useCallback(async () => {
    isActiveRef.current = false;
    cancelAnimationFrame(rafIdRef.current);
    clearSourceNode();
    if (audioContextRef.current) {
      await audioContextRef.current.close();
    }
    audioContextRef.current = null;
    gainNodeRef.current = null;
    soundTouchNodeRef.current = null;
    audioBufferRef.current = null;
    sourceOffsetRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [clearSourceNode]);

  const tick = useCallback(() => {
    if (!isActiveRef.current || !audioContextRef.current) return;
    const elapsed =
      sourceOffsetRef.current +
      (audioContextRef.current.currentTime - startAtContextTimeRef.current) * playbackRateRef.current;
    const next = loopedRef.current && durationRef.current > 0
      ? elapsed % durationRef.current
      : Math.min(elapsed, durationRef.current);
    setCurrentTime(next);
    if (!loopedRef.current && elapsed >= durationRef.current) {
      isActiveRef.current = false;
      setIsPlaying(false);
      return;
    }
    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  const beginPlaybackFromOffset = useCallback(async (offset: number) => {
    const context = audioContextRef.current;
    const stNode = soundTouchNodeRef.current;
    const buffer = audioBufferRef.current;
    const gainNode = gainNodeRef.current;
    if (!context || !stNode || !buffer || !gainNode) return;

    clearSourceNode();
    await context.resume();

    gainNode.gain.value = volume;
    stNode.pitch.value = pitch;
    stNode.pitchSemitones.value = pitchSemitones;
    stNode.playbackRate.value = playbackRate;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = loopedRef.current;
    source.connect(stNode);
    sourceNodeRef.current = source;
    sourceOffsetRef.current = offset;
    startAtContextTimeRef.current = context.currentTime;
    source.start(0, offset);
    source.onended = () => {
      if (loopedRef.current) return;
      isActiveRef.current = false;
      setIsPlaying(false);
    };
    isActiveRef.current = true;
    setIsPlaying(true);
    rafIdRef.current = requestAnimationFrame(tick);
  }, [clearSourceNode, pitch, pitchSemitones, playbackRate, tick, volume]);

  const loadAndPlay = useCallback(async () => {
    setIsLoading(true);
    try {
      await teardown();

      const context = new AudioContext();
      await SoundTouchNode.register(context, processorModuleUrl);
      await SoundTouchNode.registerStrategyModule(context, interpolationStrategiesInstallerUrl);

      const gainNode = context.createGain();
      const stNode = new SoundTouchNode({
        context,
        interpolationStrategy: { id: strategyId, params: paramValues },
      });
      stNode.connect(gainNode);
      gainNode.connect(context.destination);

      audioContextRef.current = context;
      gainNodeRef.current = gainNode;
      soundTouchNodeRef.current = stNode;

      const response = await fetch(selectedTrack.url);
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await context.decodeAudioData(arrayBuffer);
      audioBufferRef.current = decoded;
      durationRef.current = decoded.duration;
      setDuration(decoded.duration);
      setCurrentTime(0);
      sourceOffsetRef.current = 0;

      await beginPlaybackFromOffset(0);
    } finally {
      setIsLoading(false);
    }
  }, [beginPlaybackFromOffset, paramValues, selectedTrack.url, strategyId, teardown]);

  const togglePlayback = useCallback(async () => {
    if (isLoading) return;
    if (isPlaying) {
      isActiveRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
      clearSourceNode();
      sourceOffsetRef.current = currentTime;
      setIsPlaying(false);
    } else if (audioContextRef.current && audioBufferRef.current && soundTouchNodeRef.current) {
      await beginPlaybackFromOffset(sourceOffsetRef.current);
    } else {
      await loadAndPlay();
    }
  }, [beginPlaybackFromOffset, clearSourceNode, currentTime, isLoading, isPlaying, loadAndPlay]);

  const handleSeek = useCallback(async (nextTime: number) => {
    if (duration <= 0) return;
    const bounded = Math.min(duration, Math.max(0, nextTime));
    sourceOffsetRef.current = bounded;
    setCurrentTime(bounded);
    if (isPlaying) {
      await beginPlaybackFromOffset(bounded);
    }
  }, [beginPlaybackFromOffset, duration, isPlaying]);

  const updateStrategyParam = useCallback((key: string, value: number | boolean | string) => {
    setParamValues((prev) => {
      const next = { ...prev, [key]: value };
      soundTouchNodeRef.current?.setInterpolationStrategyParams(next);
      return next;
    });
  }, []);

  useEffect(() => {
    loopedRef.current = looped;
    if (sourceNodeRef.current) sourceNodeRef.current.loop = looped;
  }, [looped]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (soundTouchNodeRef.current) soundTouchNodeRef.current.playbackRate.value = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => {
    if (soundTouchNodeRef.current) soundTouchNodeRef.current.pitch.value = pitch;
  }, [pitch]);

  useEffect(() => {
    if (soundTouchNodeRef.current) soundTouchNodeRef.current.pitchSemitones.value = pitchSemitones;
  }, [pitchSemitones]);

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  return (
    <div style={{ maxWidth: 860, padding: '1rem', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ color: '#4b5563', marginTop: 0 }}>{description}</p>

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1rem' }}>
        <label style={{ display: 'block' }}>
          Track
          <select
            value={selectedTrackId}
            onChange={(e) => setSelectedTrackId(e.target.value)}
            disabled={isPlaying || isLoading}
            style={{ display: 'block', width: '100%' }}
          >
            {TRACKS.map((track) => (
              <option key={track.id} value={track.id}>{track.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'block' }}>
          Volume: {volume.toFixed(2)}
          <input
            type="range" min={0} max={2} step={0.01} value={volume}
            list="vol-ticks"
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id="vol-ticks">
            <option value={0} label="0" />
            <option value={1} label="1" />
            <option value={2} label="2" />
          </datalist>
        </label>

        <label style={{ display: 'block' }}>
          Pitch: {pitch.toFixed(2)}
          <input
            type="range" min={0.1} max={2} step={0.01} value={pitch}
            list="pitch-ticks"
            onChange={(e) => setPitch(Number(e.target.value))}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id="pitch-ticks">
            <option value={0.1} label="0.1" />
            <option value={0.5} label="0.5" />
            <option value={1} label="1" />
            <option value={1.5} label="1.5" />
            <option value={2} label="2" />
          </datalist>
        </label>

        <label style={{ display: 'block' }}>
          Pitch semitones: {pitchSemitones}
          <input
            type="range" min={-12} max={12} step={1} value={pitchSemitones}
            list="semitone-ticks"
            onChange={(e) => setPitchSemitones(Number(e.target.value))}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id="semitone-ticks">
            <option value={-12} label="-12" />
            <option value={-6} label="-6" />
            <option value={0} label="0" />
            <option value={6} label="6" />
            <option value={12} label="12" />
          </datalist>
        </label>

        <label style={{ display: 'block' }}>
          Playback rate: {playbackRate.toFixed(2)}
          <input
            type="range" min={0.1} max={4} step={0.01} value={playbackRate}
            list="rate-ticks"
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            style={{ display: 'block', width: '100%' }}
          />
          <datalist id="rate-ticks">
            <option value={0.1} label="0.1" />
            <option value={0.5} label="0.5" />
            <option value={1} label="1" />
            <option value={2} label="2" />
            <option value={4} label="4" />
          </datalist>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'end' }}>
          <input
            type="checkbox"
            checked={looped}
            onChange={(e) => setLooped(e.target.checked)}
          />
          Loop playback
        </label>
      </div>

      {Object.keys(params).length > 0 && (
        <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, marginBottom: '1rem', padding: '0.75rem' }}>
          <legend>Tuning</legend>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {Object.entries(params).map(([key, def]) => (
              <ParamControl
                key={key}
                paramKey={key}
                def={def}
                value={paramValues[key]}
                disabled={false}
                onChange={updateStrategyParam}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button type="button" onClick={() => void togglePlayback()} disabled={isLoading}>
          {isLoading ? 'Loading…' : isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: '3rem' }}>{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => void handleSeek(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: '3rem' }}>{formatTime(duration)}</span>
      </div>

      <details style={{ marginTop: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', color: '#6b7280' }}>Code sample</summary>
        <pre style={{ background: '#f3f4f6', padding: '0.75rem', borderRadius: 6, overflowX: 'auto' }}>{codeSample}</pre>
        <p>{explanation}</p>
      </details>
    </div>
  );
};