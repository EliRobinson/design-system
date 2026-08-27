import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { ChatThread } from './ChatThread.js';

describe('ChatThread', () => {
  it('is a log region named by its label', () => {
    render(<ChatThread label="Conversation" />);
    expect(screen.getByRole('log', { name: 'Conversation' })).toBeInTheDocument();
  });

  it('announces additions and edits politely by default', () => {
    render(<ChatThread label="Conversation" />);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-relevant', 'additions text');
  });

  it('opts out of live announcement when announce is false', () => {
    render(<ChatThread label="Conversation" announce={false} />);
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'off');
  });

  it('renders its children', () => {
    render(<ChatThread label="Conversation">turn</ChatThread>);
    expect(screen.getByText('turn')).toBeInTheDocument();
  });

  it('forwards its ref to the log element', () => {
    const ref = createRef<HTMLDivElement>();

    render(<ChatThread label="Conversation" ref={ref} />);

    expect(ref.current).toBe(screen.getByRole('log'));
  });

  it('releases the forwarded ref when it unmounts', () => {
    const ref = createRef<HTMLDivElement>();

    const view = render(<ChatThread label="Conversation" ref={ref} />);
    view.unmount();

    expect(ref.current).toBeNull();
  });
});

/**
 * jsdom does no layout, so every element reports `scrollHeight` and
 * `clientHeight` as `0` and `scrollTop` never moves. That makes "the browser
 * really scrolled" unprovable here — but it does not make the *decision*
 * unprovable, and the decision is where the bugs are. Stubbing the three
 * measurements gives a thread with a real geometry to reason about: which
 * distance counts as pinned, which does not, and when the component may write.
 *
 * The setter clamps the way a browser does, so `scrollTop` after a follow is a
 * position that could actually exist and an assertion on it means something.
 */
type Layout = { scrollHeight: number; clientHeight: number; scrollTop: number };

function stubLayout(element: HTMLElement, initial: Layout): Layout {
  const layout = { ...initial };

  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => layout.scrollHeight,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => layout.clientHeight,
  });
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => layout.scrollTop,
    set: (value: number) => {
      layout.scrollTop = Math.max(0, Math.min(value, layout.scrollHeight - layout.clientHeight));
    },
  });

  return layout;
}

/**
 * Mounts a thread whose element is stubbed *through the caller's own ref*.
 *
 * That is deliberate rather than incidental. The ref callback runs before any
 * layout effect, so the stub is in place for the very first measurement — and
 * because the component scrolls through an internal ref while these tests read
 * the node through the forwarded one, every following assertion below is also
 * an assertion that both ends of the merged ref got the same element.
 */
function renderThread(initial: Layout, props: { followNewMessages?: boolean } = {}) {
  const stub: { layout: Layout | null } = { layout: null };

  const setRef = (node: HTMLDivElement | null) => {
    if (node && !stub.layout) {
      stub.layout = stubLayout(node, initial);
    }
  };

  const thread = (children: ReactNode) => (
    <ChatThread label="Conversation" ref={setRef} {...props}>
      {children}
    </ChatThread>
  );

  const view = render(thread(<p>first turn</p>));

  return {
    get layout() {
      if (!stub.layout) {
        throw new Error('ChatThread never attached its ref');
      }

      return stub.layout;
    },
    /** A turn arrives: the thread grows by `by` pixels and re-renders. */
    addTurn(by: number, label = 'next turn') {
      stub.layout!.scrollHeight += by;
      view.rerender(
        thread(
          <>
            <p>first turn</p>
            <p>{label}</p>
          </>,
        ),
      );
    },
    rerenderUnchanged() {
      view.rerender(thread(<p>first turn</p>));
    },
  };
}

describe('ChatThread following the newest turn', () => {
  it('opens on the newest turn', () => {
    const view = renderThread({ scrollHeight: 1200, clientHeight: 400, scrollTop: 0 });

    expect(view.layout.scrollTop).toBe(800);
  });

  it('follows a reader who is already at the bottom', () => {
    const view = renderThread({ scrollHeight: 1200, clientHeight: 400, scrollTop: 800 });

    view.addTurn(300);

    expect(view.layout.scrollTop).toBe(1100);
  });

  it('leaves a reader who has scrolled up to re-read an earlier turn', () => {
    const view = renderThread({ scrollHeight: 1200, clientHeight: 400, scrollTop: 800 });
    view.layout.scrollTop = 100;

    view.addTurn(300);

    expect(view.layout.scrollTop).toBe(100);
  });

  it('treats a few pixels short of the bottom as still at the bottom', () => {
    // 30px from the bottom — inside the 32px threshold, which exists because a
    // zoomed page reports fractional offsets and never lands exactly on 0.
    const view = renderThread({ scrollHeight: 1200, clientHeight: 400, scrollTop: 800 });
    view.layout.scrollTop = 770;

    view.addTurn(300);

    expect(view.layout.scrollTop).toBe(1100);
  });

  it('treats a deliberate scroll away from the bottom as reading, not as slack', () => {
    // 40px from the bottom — outside the threshold. Nothing in a browser drifts
    // this far, so only a reader put it here.
    const view = renderThread({ scrollHeight: 1200, clientHeight: 400, scrollTop: 800 });
    view.layout.scrollTop = 760;

    view.addTurn(300);

    expect(view.layout.scrollTop).toBe(760);
  });

  it('does not nudge a nearly-pinned reader when nothing arrived', () => {
    const view = renderThread({ scrollHeight: 1200, clientHeight: 400, scrollTop: 800 });
    view.layout.scrollTop = 780;

    view.rerenderUnchanged();

    expect(view.layout.scrollTop).toBe(780);
  });

  it('never scrolls when followNewMessages is false', () => {
    const view = renderThread(
      { scrollHeight: 1200, clientHeight: 400, scrollTop: 0 },
      { followNewMessages: false },
    );

    expect(view.layout.scrollTop).toBe(0);

    view.addTurn(300);

    expect(view.layout.scrollTop).toBe(0);
  });

  it('does not take focus from the composer while it follows', () => {
    render(<input aria-label="Message" />);
    const composer = screen.getByRole('textbox', { name: 'Message' });
    composer.focus();

    const view = renderThread({ scrollHeight: 1200, clientHeight: 400, scrollTop: 800 });
    view.addTurn(300);

    expect(view.layout.scrollTop).toBe(1100);
    expect(document.activeElement).toBe(composer);
  });
});
