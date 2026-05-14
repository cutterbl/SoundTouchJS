import { InterpolationPlaygroundBase } from './InterpolationPlaygroundBase';

export const LanczosPlayground = () => (
  <InterpolationPlaygroundBase
    title="Lanczos Interpolation"
    description="Explore tunable parameters for the Lanczos interpolation strategy."
    codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, '/path/to/processor.js');
const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'lanczos',
    params: { zeroCrossings: 4, normalize: false },
  },
});`}
    explanation="Lanczos interpolation is ideal for high-quality resampling."
    params={{
      zeroCrossings: { min: 2, max: 8, step: 1, default: 4 },
      normalize: { type: 'boolean' as const, default: false },
    }}
    strategyId="lanczos"
  />
);