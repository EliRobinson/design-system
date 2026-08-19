import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatThread } from '@design-system/react/components/ai/ChatThread';
import { ChatMessage } from '@design-system/react/components/ai/ChatMessage';
import { StreamingCaret } from '@design-system/react/components/ai/StreamingCaret';

const meta = {
  title: 'Components/ChatThread',
  component: ChatThread,
  tags: ['autodocs'],
} satisfies Meta<typeof ChatThread>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Conversation' },
  render: () => (
    <ChatThread label="Conversation" style={{ maxWidth: 480 }}>
      <ChatMessage variant="sent" avatar="K" name="Kim" timestamp="9:42 AM">
        Can you check whether last month&apos;s invoices add up?
      </ChatMessage>
      <ChatMessage variant="received" avatar="A" name="Assistant" timestamp="9:43 AM">
        Two of the three matched. The third is short by $12 <StreamingCaret />
      </ChatMessage>
    </ChatThread>
  ),
};
