'use client';

import { ChatMessage } from '@elirobinson/react/components/ai/ChatMessage';
import { Button } from '@elirobinson/react/components/atoms/Button';

export default function Basic() {
  return (
    <div className="demo-col">
      <ChatMessage variant="sent" avatar="JR" name="Jamie" timestamp="2:04 PM">
        Can you summarise where the budget stands?
      </ChatMessage>
      <ChatMessage
        avatar="M"
        name="Assistant"
        timestamp="2:04 PM"
        actions={
          <>
            <Button variant="ghost" size="sm">
              Copy
            </Button>
            <Button variant="ghost" size="sm">
              Retry
            </Button>
          </>
        }
      >
        Two thirds of the quarter's budget is spent with five weeks left. Nothing is over yet, but
        the software line is running ahead of the others.
      </ChatMessage>
    </div>
  );
}
