import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stepper } from '@design-system/react/components/molecules/Stepper';

const meta = {
  title: 'Components/Stepper',
  component: Stepper,
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    steps: [{ label: 'Account' }, { label: 'Details' }, { label: 'Review' }],
    activeStep: 2,
  },
};
