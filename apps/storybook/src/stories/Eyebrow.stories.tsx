import type { Meta, StoryObj } from '@storybook/react-vite';
import { Eyebrow } from '@design-system/react/components/atoms/Eyebrow';

const meta = {
  title: 'Components/Eyebrow',
  component: Eyebrow,
  tags: ['autodocs'],
  args: {
    children: 'Miltinson Technologies',
  },
} satisfies Meta<typeof Eyebrow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
