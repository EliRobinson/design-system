import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '@design-system/react/components/Input';

const meta = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  args: {
    label: 'Email',
    placeholder: 'you@example.com',
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: 'We will never share your email.' },
};

export const WithError: Story = {
  args: {
    defaultValue: 'not-an-email',
    error: 'Please enter a valid email address.',
  },
};
