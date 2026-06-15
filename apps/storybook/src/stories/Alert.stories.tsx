import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert } from '@design-system/react/components/Alert';

const meta = {
  title: 'Components/Alert',
  component: Alert,
  tags: ['autodocs'],
  args: {
    title: 'Heads up',
    children: 'This is a practical, honest message — no hype.',
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Saved',
    children: 'Your changes were saved successfully.',
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    title: 'Review needed',
    children: 'Double-check your settings before continuing.',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    title: 'Error',
    children: 'Something went wrong. Please try again.',
  },
};
