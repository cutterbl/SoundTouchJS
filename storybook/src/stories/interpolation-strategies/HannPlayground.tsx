import { InterpolationPlaygroundBase } from './InterpolationPlaygroundBase';

export const HannPlayground = () => (
  <InterpolationPlaygroundBase
    title="Hann Interpolation"
    description="Explore tunable parameters for the Hann interpolation strategy."
    codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorUrl);
// Hann requires a strategy module — register it before constructing the node:
await SoundTouchNode.registerStrategyModule(context, strategyInstallerUrl);
const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'hann',
    params: { zeroCrossings: 4, normalize: false, windowPower: 1 },
  },
});`}
    explanation="Hann windowed-sinc is a good default for smooth resampling. Tune zeroCrossings, normalize, and windowPower."
    params={{
      zeroCrossings: { min: 1, max: 16, step: 1, default: 4 },
      normalize: { type: 'boolean' as const, default: false },
      windowPower: { min: 0.1, max: 2, step: 0.1, default: 1 },
    }}
    strategyId="hann"
  />
);