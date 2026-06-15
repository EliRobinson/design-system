import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from '@design-system/react/components/Textarea';

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: {
    label: 'Message',
    placeholder: 'Tell me what you need help with…',
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: "I'll get back to you within 24 hours." },
};

export const WithError: Story = {
  args: { error: 'Please enter a message.' },
};
