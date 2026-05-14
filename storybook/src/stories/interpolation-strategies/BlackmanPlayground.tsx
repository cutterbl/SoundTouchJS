import { InterpolationPlaygroundBase } from './InterpolationPlaygroundBase';

export const BlackmanPlayground = () => (
  <InterpolationPlaygroundBase
    title="Blackman Interpolation"
    description="Explore tunable parameters for the Blackman interpolation strategy."
    codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorUrl);
// Blackman requires a strategy module — register it before constructing the node:
await SoundTouchNode.registerStrategyModule(context, strategyInstallerUrl);
const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'blackman',
    params: { zeroCrossings: 4, normalize: false, alpha: 0.42, beta: 0.5, gamma: 0.08 },
  },
});`}
    explanation="Blackman windowed-sinc offers strong stopband attenuation. Tune zeroCrossings, normalize, alpha, beta, gamma."
    params={{
      zeroCrossings: { min: 1, max: 16, step: 1, default: 4 },
      normalize: { type: 'boolean' as const, default: false },
      alpha: { min: 0, max: 1, step: 0.01, default: 0.42 },
      beta: { min: 0, max: 1, step: 0.01, default: 0.5 },
      gamma: { min: 0, max: 1, step: 0.01, default: 0.08 },
    }}
    strategyId="blackman"
  />
);