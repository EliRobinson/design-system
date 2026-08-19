import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatMessage } from '@design-system/react/components/ai/ChatMessage';

const meta = {
  title: 'Components/ChatMessage',
  component: ChatMessage,
  tags: ['autodocs'],
  args: {
    avatar: 'A',
    name: 'Assistant',
    timestamp: '9:41 AM',
    children: 'I checked the last three invoices. Two matched, one was short by $12.',
  },
} satisfies Meta<typeof ChatMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Received: Story = {
  args: {
    variant: 'received',
    avatar: 'A',
    name: 'Assistant',
    timestamp: '9:41 AM',
    children: 'I checked the last three invoices. Two matched, one was short by $12.',
  },
};

export const Sent: Story = {
  args: {
    variant: 'sent',
    avatar: 'K',
    name: 'Kim',
    timestamp: '9:42 AM',
    children: 'Good catch. Can you pull the short one up so I can see the line items?',
  },
};
