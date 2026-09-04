'use client';

/**
 * The client half of the round trip. `chat-route.ts` is the server half.
 *
 * Three vendored components and one hook, and nothing between them: `useChat`
 * holds the message list and the stream status, `Conversation` keeps the log
 * pinned to the bottom while tokens arrive, and `PromptInput` is a real form —
 * its `onSubmit` hands over the typed text, so there is no controlled-input
 * state to keep here.
 *
 * Everything on screen is Tailwind utility markup compiled through
 * `@elirobinson/tokens/tailwind.css`, so it is already in Miltinson colours and
 * already follows the theme dial. There is no per-component stylesheet to
 * import and nothing to override.
 */

import { useChat } from '@ai-sdk/react';

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@elirobinson/ai-elements/components/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@elirobinson/ai-elements/components/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@elirobinson/ai-elements/components/prompt-input';

export function Chat() {
  const { messages, sendMessage, status, stop } = useChat();

  return (
    <div className="flex h-full flex-col">
      <Conversation>
        <ConversationContent>
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, index) =>
                  part.type === 'text' ? (
                    /* Parts have no id of their own, and their order within a
                       message is stable, so the index is the key. */
                    <MessageResponse key={index}>{part.text}</MessageResponse>
                  ) : null,
                )}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        onSubmit={(message) => {
          if (message.text.trim() === '') {
            return;
          }
          sendMessage({ text: message.text });
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea />
        </PromptInputBody>
        <PromptInputFooter>
          {/* `status` drives the button between send, stop and disabled — the
              same value `useChat` reports, so the control cannot disagree with
              the stream. */}
          <PromptInputSubmit onStop={stop} status={status} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
