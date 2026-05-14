import type { Meta, StoryObj } from '@storybook/react-vite';
import { HannPlayground } from './HannPlayground';

const meta = {
  title: 'Interpolation Strategies/Hann',
  component: HannPlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof HannPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HannKitchenSink: Story = {
  render: () => <HannPlayground />,
};
