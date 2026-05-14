import { InterpolationPlaygroundBase } from './InterpolationPlaygroundBase';

export const LinearPlayground = () => (
  <InterpolationPlaygroundBase
    title="Linear Interpolation"
    description="Explore tunable parameters for the Linear interpolation strategy."
    codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorUrl);
// Linear requires a strategy module — register it before constructing the node:
await SoundTouchNode.registerStrategyModule(context, strategyInstallerUrl);
const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'linear',
    params: { edgeHoldFrames: 1, blend: 1 },
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