import { InterpolationPlaygroundBase } from './InterpolationPlaygroundBase';

export const KaiserPlayground = () => (
  <InterpolationPlaygroundBase
    title="Kaiser Interpolation"
    description="Explore tunable parameters for the Kaiser interpolation strategy."
    codeSample={`const context = new AudioContext();
await SoundTouchNode.register(context, processorUrl);
// Kaiser requires a strategy module — register it before constructing the node:
await SoundTouchNode.registerStrategyModule(context, strategyInstallerUrl);
const soundTouchNode = new SoundTouchNode({
  context,
  interpolationStrategy: {
    id: 'kaiser',
    params: { zeroCrossings: 4, beta: 8.6, normalize: false, windowPower: 1 },
  },
});`}
    explanation="Kaiser windowed-sinc is highly tunable. Adjust zeroCrossings, beta, normalize, and windowPower for quality/performance."
    params={{
      zeroCrossings: { min: 2, max: 16, step: 1, default: 4 },
      beta: { min: 0, max: 20, step: 0.1, default: 8.6 },
      normalize: { type: 'boolean' as const, default: false },
      windowPower: { min: 0.1, max: 2, step: 0.1, default: 1 },
    }}
    strategyId="kaiser"
  />
);