import type { Meta, StoryObj } from '@storybook/react-vite';

import { StretchParametersPlayground } from './StretchParametersPlayground';

const meta = {
  title: 'Stretch Parameters',
  component: StretchParametersPlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof StretchParametersPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Defaults: Story = {
  render: () => (
    <StretchParametersPlayground
      initialPitchSemitones={5}
      initialSequenceMs={0}
      initialSeekWindowMs={0}
      initialOverlapMs={8}
      initialQuickSeek={true}
    />
  ),
};

export const ManualTiming: Story = {
  render: () => (
    <StretchParametersPlayground
      initialPitchSemitones={7}
      initialSequenceMs={82}
      initialSeekWindowMs={28}
      initialOverlapMs={12}
      initialQuickSeek={true}
    />
  ),
};

export const ExhaustiveSearch: Story = {
  render: () => (
    <StretchParametersPlayground
      initialPitchSemitones={5}
      initialSequenceMs={0}
      initialSeekWindowMs={0}
      initialOverlapMs={8}
      initialQuickSeek={false}
    />
  ),
};
