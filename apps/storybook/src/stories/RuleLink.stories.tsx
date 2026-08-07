import type { Meta, StoryObj } from '@storybook/react-vite';
import { RuleLink } from '@design-system/react/components/molecules/RuleLink';

const meta = {
  title: 'Components/RuleLink',
  component: RuleLink,
  tags: ['autodocs'],
  args: {
    children: 'View all guides',
    href: '#',
  },
} satisfies Meta<typeof RuleLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
