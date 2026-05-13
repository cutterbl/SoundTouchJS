import type { Meta, StoryObj } from '@storybook/react-vite';

import { FormantCorrectionPlayground } from './FormantCorrectionPlayground';

const meta = {
  title: 'Formant Correction',
  component: FormantCorrectionPlayground,
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
  },
} satisfies Meta<typeof FormantCorrectionPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PerfectFifth: Story = {
  render: () => (
    <FormantCorrectionPlayground
      initialPitchSemitones={7}
      initialFormantStrength={1}
    />
  ),
};

export const Octave: Story = {
  render: () => (
    <FormantCorrectionPlayground
      initialPitchSemitones={12}
      initialFormantStrength={1}
    />
  ),
};

export const RawVsCorrected: Story = {
  render: () => (
    <FormantCorrectionPlayground
      initialPitchSemitones={7}
      initialFormantStrength={0}
    />
  ),
};
