import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type ChatMessageVariant = 'sent' | 'received';

export type ChatMessageProps = HTMLAttributes<HTMLDivElement> & {
  /** Which side of the conversation this turn is. Default 'received'. */
  variant?: ChatMessageVariant;
  /** The avatar mark. Required — the system derives nothing from the variant. */
  avatar: ReactNode;
  /** Who is speaking. This, not the avatar, is what identifies the turn. */
  name?: string;
  /** Pre-formatted time string. Formatting is the product's call, not the system's. */
  timestamp?: string;
  /** Turn-level affordances, as a node. */
  actions?: ReactNode;
};

/** A single turn in a conversation: avatar, optional attribution, content, and actions. */
export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(function ChatMessage(
  { className, variant = 'received', avatar, name, timestamp, actions, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('ds-chat-message', `ds-chat-message--${variant}`, className)}
      {...props}
    >
      {/* The frame is an `Avatar` at its `md` step, taken by class rather than
          hand-drawn here: `ds-avatar ds-avatar--md` is the same 40px circle,
          `--bg-muted` fill and pill radius `Avatar.css` gives every other
          avatar in the system, so there is one avatar scale and this is on it.
          What is ChatMessage's own is the hairline `--border-control` edge and
          the mark colour, and that is all `ChatMessage.css` still declares.

          It is a class and not an <Avatar> element because `avatar` is an
          arbitrary node — a glyph, a mark, a consumer's own <Avatar> — and
          `Avatar` renders an <img> or derived initials, with nothing to hand a
          node to. Composing the stylesheet is the composition available; a
          second 40px circle declared here would be the duplication.

          It stays aria-hidden. The avatar is a decorative restatement of the
          speaker, so `name` is the single thing that identifies a turn to a
          screen reader — that keeps one turn from being announced twice, and
          keeps identification off a node the consumer may pass as a bare
          glyph. */}
      <div className="ds-avatar ds-avatar--md ds-chat-message__avatar" aria-hidden="true">
        <span className="ds-chat-message__mark">{avatar}</span>
      </div>
      <div className="ds-chat-message__body">
        {name || timestamp ? (
          <div className="ds-chat-message__meta">
            {name ? <span className="ds-chat-message__name">{name}</span> : null}
            {timestamp ? <span className="ds-chat-message__time">{timestamp}</span> : null}
          </div>
        ) : null}
        <div className="ds-chat-message__content">{children}</div>
        {actions ? <div className="ds-chat-message__actions">{actions}</div> : null}
      </div>
    </div>
  );
});
