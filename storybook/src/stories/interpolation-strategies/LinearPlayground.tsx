import { InterpolationPlaygroundBase } from './InterpolationPlaygroundBase';

export const LinearPlayground = () => (
  <InterpolationPlaygroundBase
    title="Linear Interpolation"
    description="Explore tunable parameters for the Linear interpolation strategy."
    codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, '/path/to/processor.js');
const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'linear',
    params: {},
  },
});`}
    explanation="Linear interpolation is the simplest strategy."
    params={{
      edgeHoldFrames: { min: 0, max: 32, step: 1, default: 1 },
      blend: { min: 0, max: 1, step: 0.01, default: 1 },
      normalize: { type: 'boolean' as const, default: false },
    }}
    strategyId="linear"
  />
);