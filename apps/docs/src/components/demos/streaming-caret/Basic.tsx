'use client';

import { useState } from 'react';

import { ChatMessage } from '@elirobinson/react/components/ai/ChatMessage';
import { StreamingCaret } from '@elirobinson/react/components/ai/StreamingCaret';
import { Button } from '@elirobinson/react/components/atoms/Button';

export default function Basic() {
  const [streaming, setStreaming] = useState(true);

  return (
    <div className="demo-col">
      <ChatMessage avatar="M" name="Assistant" timestamp="11:12 AM">
        Here's the short version: the renewal is cheaper than the two repairs you'd expect without
        it
        <StreamingCaret active={streaming} label="Still writing" />
      </ChatMessage>
      <Button variant="secondary" size="sm" onClick={() => setStreaming(!streaming)}>
        {streaming ? 'Finish the turn' : 'Start writing again'}
      </Button>
    </div>
  );
}
