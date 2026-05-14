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

const WINDOW_POWER_TICKS: readonly DatalistTick[] = [
  { value: 0.1, label: '0.1' },
  { value: 0.5, label: '0.5' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1.5' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
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
    key: 'windowPower',
    label: 'windowPower',
    min: 0.1,
    max: 3,
    step: 0.01,
    ticks: WINDOW_POWER_TICKS,
  },
];

export function HannInterpolationPlayground(): JSX.Element {
  return (
    <InterpolationStrategyPlayground
      title="Hann Interpolation"
      strategyId="hann"
      initialParams={{ zeroCrossings: 4, normalize: 0, windowPower: 1 }}
      paramControls={CONTROLS}
      description="Kitchen sink for the Hann strategy with direct controls for all tunable params."
      codeSample={`const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'hann',
    params: { zeroCrossings: 4, normalize: 0, windowPower: 1 },
  },
});

soundTouchNode.setInterpolationStrategyParams({ windowPower: 1.5 });`}
      explanation="Hann balances smoothness and performance. Increase zeroCrossings for smoother transitions and shape the window with windowPower."
    />
  );
}
