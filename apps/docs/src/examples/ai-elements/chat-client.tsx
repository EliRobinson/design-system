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
 * The Tailwind utilities the vendored components carry are compiled through
 * `@elirobinson/tokens/tailwind.css` and the AI Elements bridge, so the colours
 * are already Miltinson's and already follow all three dials. What the classes
 * below add is the half a variable bridge cannot express — shape, density and
 * the editorial decisions. They are `.ds-ai-*` classes from
 * `app/ai-theme/ai-core.css`, passed in through `className`, which is the
 * package's public API. Nothing here overrides a vendored component from
 * outside, and no vendored component is recreated.
 *
 * Three of those decisions are load-bearing and are the reason the markup below
 * is not the smallest thing that renders:
 *
 *  - ONLY THE USER'S TURN GETS A BUBBLE. The assistant's turn is flat prose.
 *    `Message` sets `.is-user` / `.is-assistant` on its own wrapper and the
 *    stylesheet keys off that, so this file passes one class to both and the
 *    asymmetry comes from the layer.
 *  - A MONO EYEBROW NAMES THE SPEAKER, rather than a coloured bubble implying
 *    it. A colour is not a name, and a screen reader cannot read one out.
 *  - THE FOOTNOTE IS PART OF THE PATTERN. An honesty line under the composer is
 *    not decoration, and removing it is a product decision, not a tidy-up.
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

const SPEAKER: Record<string, string> = { user: 'You', assistant: 'Assistant' };

export function Chat() {
  const { messages, sendMessage, status, stop } = useChat();

  return (
    <div className="flex h-full flex-col">
      <Conversation className="ds-ai-conversation">
        <ConversationContent className="ds-ai-conversation__content">
          {messages.length === 0 ? (
            <div className="ds-ai-conversation__empty">
              <h3>Ask about anything in the catalogue</h3>
              <p>Answers cite their sources. Tool calls are shown as they run.</p>
            </div>
          ) : null}

          {messages.map((message) => (
            <Message className="ds-ai-message" from={message.role} key={message.id}>
              {/* Not inside MessageContent: the eyebrow sits above the bubble,
                  not in it, and on a user turn the layer aligns it to the end
                  edge to match. */}
              <p className="ds-ai-message__speaker">{SPEAKER[message.role] ?? message.role}</p>
              <MessageContent className="ds-ai-message__content">
                {message.parts.map((part, index) =>
                  part.type === 'text' ? (
                    /* Parts have no id of their own, and their order within a
                       message is stable, so the index is the key. */
                    <MessageResponse className="ds-ai-response" key={index}>
                      {part.text}
                    </MessageResponse>
                  ) : null,
                )}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        className="ds-ai-composer"
        onSubmit={(message) => {
          if (message.text.trim() === '') {
            return;
          }
          sendMessage({ text: message.text });
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea className="ds-ai-composer__field" />
        </PromptInputBody>
        <PromptInputFooter className="ds-ai-composer__toolbar">
          <div className="ds-ai-composer__tools" />
          {/* `status` drives the button between send, stop and disabled — the
              same value `useChat` reports, so the control cannot disagree with
              the stream. The submit is the one amber control in the
              conversation, and it is 44px; everything else in the toolbar is
              the 24px dense tier. */}
          <PromptInputSubmit className="ds-ai-composer__submit" onStop={stop} status={status} />
        </PromptInputFooter>
      </PromptInput>
      <p className="ds-ai-composer__footnote">
        Answers are generated and can be wrong. Check anything that matters.
      </p>
    </div>
  );
}
