import { InterpolationPlaygroundBase } from './InterpolationPlaygroundBase';

export const BlackmanPlayground = () => (
  <InterpolationPlaygroundBase
    title="Blackman Interpolation"
    description="Explore tunable parameters for the Blackman interpolation strategy."
    codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, '/path/to/processor.js');
const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'blackman',
    params: { zeroCrossings: 4, normalize: false, alpha: 0.16, beta: 0.42, gamma: 0.42 },
  },
});`}
    explanation="Blackman windowed-sinc offers strong stopband attenuation. Tune zeroCrossings, normalize, alpha, beta, gamma."
    params={{
      zeroCrossings: { min: 1, max: 16, step: 1, default: 4 },
      normalize: { type: 'boolean' as const, default: false },
      alpha: { min: 0, max: 1, step: 0.01, default: 0.16 },
      beta: { min: 0, max: 1, step: 0.01, default: 0.42 },
      gamma: { min: 0, max: 1, step: 0.01, default: 0.42 },
    }}
    strategyId="blackman"
  />
);