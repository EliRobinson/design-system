import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from '@design-system/react/components/atoms/Label';

const meta = {
  title: 'Components/Label',
  component: Label,
  tags: ['autodocs'],
  args: {
    children: 'Email address',
    htmlFor: 'email',
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
