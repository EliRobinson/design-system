import type { Meta, StoryObj } from '@storybook/react-vite';
import { StubCard } from '@design-system/react/components/molecules/StubCard';

const meta = {
  title: 'Components/StubCard',
  component: StubCard,
  tags: ['autodocs'],
  args: {
    title: 'Order summary',
    items: [
      { label: 'Plan', value: 'Team' },
      { label: 'Seats', value: '12' },
      { label: 'Billing', value: 'Monthly' },
    ],
    stubLabel: 'Total',
    stubValue: '$144',
  },
} satisfies Meta<typeof StubCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithFootnote: Story = {
  args: {
    stubCaption: 'per month',
    footnote: 'Tax is added at checkout. Cancel any time — you keep the rest of the month.',
  },
};
