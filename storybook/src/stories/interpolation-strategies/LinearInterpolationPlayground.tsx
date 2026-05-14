import { type JSX } from 'react';

import {
  type DatalistTick,
  InterpolationStrategyPlayground,
  type ParamControl,
} from './InterpolationStrategyPlayground';

const ZERO_CROSSING_TICKS: readonly DatalistTick[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 8, label: '8' },
  { value: 16, label: '16' },
];

const BLEND_TICKS: readonly DatalistTick[] = [
  { value: 0, label: '0' },
  { value: 0.25, label: '0.25' },
  { value: 0.5, label: '0.5' },
  { value: 0.75, label: '0.75' },
  { value: 1, label: '1' },
];

const BOOLEAN_TICKS: readonly DatalistTick[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
];

const CONTROLS: readonly ParamControl[] = [
  {
    key: 'zeroCrossings',
    label: 'zeroCrossings',
    min: 1,
    max: 16,
    step: 1,
    ticks: ZERO_CROSSING_TICKS,
  },
  {
    key: 'blend',
    label: 'blend',
    min: 0,
    max: 1,
    step: 0.01,
    ticks: BLEND_TICKS,
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
];

export function LinearInterpolationPlayground(): JSX.Element {
  return (
    <InterpolationStrategyPlayground
      title="Linear Interpolation"
      strategyId="linear"
      initialParams={{ zeroCrossings: 2, blend: 0.5, normalize: 0 }}
      paramControls={CONTROLS}
      description="Kitchen sink for the Linear strategy with direct controls for all tunable params."
      codeSample={`const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'linear',
    params: { zeroCrossings: 2, blend: 0.5, normalize: 0 },
  },
});

soundTouchNode.setInterpolationStrategyParams({ blend: 0.8 });`}
      explanation="Linear is typically the fastest strategy. Increase zeroCrossings and blend for smoother interpolation; enable normalize when you need explicit weight normalization."
    />
  );
}
