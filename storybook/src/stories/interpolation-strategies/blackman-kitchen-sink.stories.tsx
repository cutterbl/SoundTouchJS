import type { Meta, StoryObj } from '@storybook/react-vite';
import { BlackmanPlayground } from './BlackmanPlayground';

const meta = {
  title: 'Interpolation Strategies/Blackman',
  component: BlackmanPlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof BlackmanPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BlackmanKitchenSink: Story = {
  render: () => <BlackmanPlayground />,
};
