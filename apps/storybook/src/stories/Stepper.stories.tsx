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

/** Below 30rem the steps stack, one per line. */
export const Narrow: Story = {
  args: {
    steps: [{ label: 'Cart' }, { label: 'Shipping' }, { label: 'Payment' }, { label: 'Review' }],
    activeStep: 2,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};
