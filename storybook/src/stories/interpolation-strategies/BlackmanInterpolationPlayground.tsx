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

const BLACKMAN_COEFF_TICKS: readonly DatalistTick[] = [
  { value: 0, label: '0.0' },
  { value: 0.16, label: '0.16' },
  { value: 0.34, label: '0.34' },
  { value: 0.42, label: '0.42' },
  { value: 0.5, label: '0.5' },
  { value: 1, label: '1.0' },
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
    key: 'alpha',
    label: 'alpha',
    min: 0,
    max: 1,
    step: 0.01,
    ticks: BLACKMAN_COEFF_TICKS,
  },
  {
    key: 'beta',
    label: 'beta',
    min: 0,
    max: 1,
    step: 0.01,
    ticks: BLACKMAN_COEFF_TICKS,
  },
  {
    key: 'gamma',
    label: 'gamma',
    min: 0,
    max: 1,
    step: 0.01,
    ticks: BLACKMAN_COEFF_TICKS,
  },
];

export function BlackmanInterpolationPlayground(): JSX.Element {
  return (
    <InterpolationStrategyPlayground
      title="Blackman Interpolation"
      strategyId="blackman"
      initialParams={{
        zeroCrossings: 4,
        normalize: 0,
        alpha: 0.16,
        beta: 0.42,
        gamma: 0.42,
      }}
      paramControls={CONTROLS}
      description="Kitchen sink for the Blackman strategy with direct controls for all tunable params."
      codeSample={`const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'blackman',
    params: {
      zeroCrossings: 4,
      normalize: 0,
      alpha: 0.16,
      beta: 0.42,
      gamma: 0.42,
    },
  },
});

soundTouchNode.setInterpolationStrategyParams({ alpha: 0.2, beta: 0.5 });`}
      explanation="Blackman improves stopband rejection. Tune zeroCrossings and Blackman coefficients to shape filtering behavior for your source material."
    />
  );
}
