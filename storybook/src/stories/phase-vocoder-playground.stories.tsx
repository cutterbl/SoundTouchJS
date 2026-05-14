import type { Meta, StoryObj } from '@storybook/react-vite';

import { PhaseVocoderPlayground } from './PhaseVocoderPlayground';

const meta = {
  title: 'Phase Vocoder',
  component: PhaseVocoderPlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof PhaseVocoderPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Defaults: Story = {
  render: () => (
    <PhaseVocoderPlayground
      initialPitchSemitones={5}
      initialFftSize={2048}
      initialOverlapFactor={4}
    />
  ),
};

export const HighQuality: Story = {
  render: () => (
    <PhaseVocoderPlayground
      initialPitchSemitones={7}
      initialFftSize={4096}
      initialOverlapFactor={8}
    />
  ),
};

export const LowLatency: Story = {
  render: () => (
    <PhaseVocoderPlayground
      initialPitchSemitones={5}
      initialFftSize={512}
      initialOverlapFactor={2}
    />
  ),
};
