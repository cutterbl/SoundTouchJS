import type { Meta, StoryObj } from '@storybook/react-vite';
import { KaiserPlayground } from './KaiserPlayground';

const meta = {
  title: 'Interpolation Strategies/Kaiser',
  component: KaiserPlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof KaiserPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const KaiserKitchenSink: Story = {
  render: () => <KaiserPlayground />,
};
