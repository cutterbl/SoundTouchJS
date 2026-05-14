import { type JSX } from 'react';

import {
  type DatalistTick,
  InterpolationStrategyPlayground,
  type ParamControl,
} from './InterpolationStrategyPlayground';

const ZERO_CROSSING_TICKS: readonly DatalistTick[] = [
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 6, label: '6' },
  { value: 8, label: '8' },
  { value: 12, label: '12' },
  { value: 16, label: '16' },
];

const BOOLEAN_TICKS: readonly DatalistTick[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
];

const WINDOW_TYPE_TICKS: readonly DatalistTick[] = [
  { value: 0, label: 'hann' },
  { value: 1, label: 'blackman' },
  { value: 2, label: 'kaiser' },
];

const CONTROLS: readonly ParamControl[] = [
  {
    key: 'zeroCrossings',
    label: 'zeroCrossings',
    min: 2,
    max: 16,
    step: 1,
    ticks: ZERO_CROSSING_TICKS,
  },
  {
    key: 'normalize',
    label: 'normalize',
    min: 0,
    max: 1,
    step: 1,
    ticks: BOOLEAN_TICKS,
    display: (value) => (value >= 0.5 ? 'true (1)' : 'false (0)'),
  },
  {
    key: 'windowType',
    label: 'windowType',
    min: 0,
    max: 2,
    step: 1,
    ticks: WINDOW_TYPE_TICKS,
    display: (value) => {
      if (value < 0.5) {
        return 'hann (0)';
      }
      if (value < 1.5) {
        return 'blackman (1)';
      }
      return 'kaiser (2)';
    },
  },
];

export function LanczosInterpolationPlayground(): JSX.Element {
  return (
    <InterpolationStrategyPlayground
      title="Lanczos Interpolation"
      strategyId="lanczos"
      initialParams={{ zeroCrossings: 4, normalize: 0, windowType: 0 }}
      paramControls={CONTROLS}
      description="Kitchen sink for the Lanczos strategy with direct controls for all tunable params."
      codeSample={`const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'lanczos',
    params: { zeroCrossings: 4, normalize: 0, windowType: 0 },
  },
});

soundTouchNode.setInterpolationStrategyParams({ windowType: 2 });`}
      explanation="Lanczos is a strong quality default. Tune zeroCrossings for kernel width, normalize for weight behavior, and windowType to reshape the windowing curve."
    />
  );
}
