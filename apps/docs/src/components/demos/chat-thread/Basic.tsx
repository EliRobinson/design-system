'use client';

import { ChatMessage } from '@elirobinson/react/components/ai/ChatMessage';
import { ChatThread } from '@elirobinson/react/components/ai/ChatThread';

export default function Basic() {
  return (
    <ChatThread label="Support conversation">
      <ChatMessage variant="sent" avatar="JR" name="Jamie" timestamp="9:41 AM">
        My invoice still shows last month's rate. Did the new one take effect?
      </ChatMessage>
      <ChatMessage avatar="M" name="Assistant" timestamp="9:41 AM">
        It did, on the 1st. The invoice you're looking at covers the period before that, so it bills
        at the old rate. The next one picks up the new rate.
      </ChatMessage>
      <ChatMessage variant="sent" avatar="JR" name="Jamie" timestamp="9:42 AM">
        That makes sense. Thanks.
      </ChatMessage>
    </ChatThread>
  );
}
