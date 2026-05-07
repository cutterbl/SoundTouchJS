import type { Meta, StoryObj } from '@storybook/react-vite';

import { SoundTouchPlayground } from './SoundTouchPlayground';

const meta = {
  title: 'App/SoundTouch Playground',
  component: SoundTouchPlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof SoundTouchPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BufferCircularLanczosActionable: Story = {
  render: () => (
    <SoundTouchPlayground
      title="Buffer source: circular + lanczos8"
      sourceMode="buffer"
      sampleBufferType="circular"
      interpolationStrategy="lanczos8"
      defaultTrackId="actionable"
    />
  ),
};

export const BufferFifoLinearDowntown: Story = {
  render: () => (
    <SoundTouchPlayground
      title="Buffer source: fifo + linear"
      sourceMode="buffer"
      sampleBufferType="fifo"
      interpolationStrategy="linear"
      defaultTrackId="downtown"
    />
  ),
};

export const BufferFifoLanczosHappiness: Story = {
  render: () => (
    <SoundTouchPlayground
      title="Buffer source: fifo + lanczos8"
      sourceMode="buffer"
      sampleBufferType="fifo"
      interpolationStrategy="lanczos8"
      defaultTrackId="happiness"
    />
  ),
};

export const ElementCircularLanczosRetroSoul: Story = {
  render: () => (
    <SoundTouchPlayground
      title="Audio element source: circular + lanczos8"
      sourceMode="element"
      sampleBufferType="circular"
      interpolationStrategy="lanczos8"
      defaultTrackId="retrosoul"
    />
  ),
};

export const ElementFifoLinearHipJazz: Story = {
  render: () => (
    <SoundTouchPlayground
      title="Audio element source: fifo + linear"
      sourceMode="element"
      sampleBufferType="fifo"
      interpolationStrategy="linear"
      defaultTrackId="hipjazz"
    />
  ),
};

export const ElementFifoLanczosActionable: Story = {
  render: () => (
    <SoundTouchPlayground
      title="Audio element source: fifo + lanczos8"
      sourceMode="element"
      sampleBufferType="fifo"
      interpolationStrategy="lanczos8"
      defaultTrackId="actionable"
    />
  ),
};
