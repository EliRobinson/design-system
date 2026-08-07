import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@design-system/react/components/atoms/Avatar';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  args: {
    alt: 'Eli Robinson',
    size: 'md',
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  args: {
    src: 'https://avatars.githubusercontent.com/u/1?v=4',
    fallback: 'ER',
  },
};

export const Fallback: Story = {
  args: {
    size: 'lg',
    fallback: 'ER',
  },
};

export const Small: Story = {
  args: { size: 'sm', fallback: 'ER' },
};

export const Large: Story = {
  args: { size: 'lg', fallback: 'ER' },
};
