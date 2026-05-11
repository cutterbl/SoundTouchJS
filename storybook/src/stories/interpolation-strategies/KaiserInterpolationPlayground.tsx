import { type JSX } from 'react';

import {
  type DatalistTick,
  InterpolationStrategyPlayground,
  type ParamControl,
} from './InterpolationStrategyPlayground';

const ZERO_CROSSINGS_TICKS: readonly DatalistTick[] = [
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 6, label: '6' },
  { value: 8, label: '8' },
  { value: 12, label: '12' },
  { value: 16, label: '16' },
];

const BETA_TICKS: readonly DatalistTick[] = [
  { value: 0, label: '0' },
  { value: 4, label: '4' },
  { value: 8.6, label: '8.6' },
  { value: 12, label: '12' },
  { value: 16, label: '16' },
  { value: 20, label: '20' },
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
    ticks: ZERO_CROSSINGS_TICKS,
  },
  {
    key: 'beta',
    label: 'beta',
    min: 0,
    max: 20,
    step: 0.1,
    ticks: BETA_TICKS,
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

export function KaiserInterpolationPlayground(): JSX.Element {
  return (
    <InterpolationStrategyPlayground
      title="Kaiser Interpolation"
      strategyId="kaiser"
      initialParams={{ zeroCrossings: 4, beta: 8.6, normalize: 0, windowPower: 1 }}
      paramControls={CONTROLS}
      description="Kitchen sink for the Kaiser strategy with direct controls for all tunable params."
      codeSample={`const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'kaiser',
    params: { zeroCrossings: 4, beta: 8.6, normalize: 0, windowPower: 1 },
  },
});

soundTouchNode.setInterpolationStrategyParams({ beta: 10, windowPower: 1.2 });`}
      explanation="Kaiser is the most tunable strategy. ZeroCrossings and beta control the window shape and transition behavior, while windowPower and normalize refine output behavior."
    />
  );
}
