import type { Meta, StoryObj } from '@storybook/react-vite';
import { LanczosPlayground } from './LanczosPlayground';

const meta = {
  title: 'Interpolation Strategies/Lanczos',
  component: LanczosPlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof LanczosPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LanczosKitchenSink: Story = {
  render: () => <LanczosPlayground />,
};
