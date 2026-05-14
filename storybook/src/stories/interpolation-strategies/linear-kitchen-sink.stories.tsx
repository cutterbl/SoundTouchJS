import type { Meta, StoryObj } from '@storybook/react-vite';
import { LinearPlayground } from './LinearPlayground';

const meta = {
  title: 'Interpolation Strategies/Linear',
  component: LinearPlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof LinearPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LinearKitchenSink: Story = {
  render: () => <LinearPlayground />,
};
