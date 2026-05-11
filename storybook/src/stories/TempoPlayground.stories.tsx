import { SoundTouchPlayground } from '../app/SoundTouchPlayground';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Core/Tempo Playground',
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <SoundTouchPlayground
      title="Tempo Playground"
      sourceMode="buffer"
      sampleBufferType="fifo"
      interpolationStrategy="lanczos"
      defaultTrackId="actionable"
    />
  ),
};
