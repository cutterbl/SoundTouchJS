import type { Meta, StoryObj } from '@storybook/react-vite';

import { ProcessOfflinePlayground } from './ProcessOfflinePlayground';

const meta = {
  title: 'Process Offline',
  component: ProcessOfflinePlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof ProcessOfflinePlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PitchUp: Story = {
  render: () => (
    <ProcessOfflinePlayground
      initialPitchSemitones={5}
      initialPlaybackRate={1}
    />
  ),
};

export const PitchDown: Story = {
  render: () => (
    <ProcessOfflinePlayground
      initialPitchSemitones={-5}
      initialPlaybackRate={1}
    />
  ),
};

export const SlowedDown: Story = {
  render: () => (
    <ProcessOfflinePlayground
      initialPitchSemitones={0}
      initialPlaybackRate={0.75}
    />
  ),
};
