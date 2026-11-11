import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadioGroup, RadioGroupItem } from '@design-system/react/components/atoms/RadioGroup';

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { name: 'plan', defaultValue: 'pro', children: null },
  render: () => (
    <RadioGroup name="plan" defaultValue="pro">
      <RadioGroupItem value="free" label="Free" />
      <RadioGroupItem value="pro" label="Pro" />
      <RadioGroupItem value="enterprise" label="Enterprise" />
    </RadioGroup>
  ),
};

export const WithError: Story = {
  args: { name: 'plan-error', error: 'Choose a plan to continue.', children: null },
  render: (args) => (
    <RadioGroup name="plan-error" aria-label="Plan" error={args.error}>
      <RadioGroupItem value="free" label="Free" />
      <RadioGroupItem value="pro" label="Pro" />
      <RadioGroupItem value="enterprise" label="Enterprise" />
    </RadioGroup>
  ),
};
