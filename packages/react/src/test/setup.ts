import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// Everything below polyfills a standard DOM API that jsdom does not implement
// at all. That is the only thing this file does globally — it never fakes
// layout *values*, because a package-wide lie about element geometry would
// silently corrupt any test that measures anything. Suites that need a
// measurable viewport opt in explicitly via `stubViewportLayout()`
// (test/viewport.ts).
//
// Server-rendering suites (`// @vitest-environment node`) share this setup file
// but have no DOM to patch, so the whole block is skipped there rather than
// throwing on the first missing global.
const hasDom = typeof document !== 'undefined';

if (hasDom && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}

if (hasDom && !HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

// jsdom has no ResizeObserver. @tanstack/react-virtual constructs one to watch
// its scroll container; without this it throws before computing a row range.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}

// jsdom implements neither `Element.prototype.scrollTo` nor scroll events.
// TanStack Virtual calls `scrollElement?.scrollTo?.()` (optional, so it
// silently no-ops without this) and then waits for a `scroll` event to
// recompute the rendered window — so `virtualizer.scrollToIndex()` would do
// nothing at all in tests. Assigning scrollTop/scrollLeft and emitting
// `scroll` is what a real browser does; jsdom just has no scrolling
// implementation to do it.
//
// The event is dispatched in a microtask because browsers fire `scroll`
// asynchronously, after the scroll is applied — never re-entrantly inside the
// caller. Dispatching inline instead lands the listener in the middle of
// React's commit phase, where TanStack Virtual's `flushSync` warns that React
// is already rendering. That warning is an artifact of the polyfill, not of
// the component under test.
if (hasDom && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo(
    optionsOrX?: ScrollToOptions | number,
    y?: number,
  ) {
    if (typeof optionsOrX === 'number') {
      this.scrollLeft = optionsOrX;
      this.scrollTop = y ?? this.scrollTop;
    } else if (optionsOrX) {
      this.scrollLeft = optionsOrX.left ?? this.scrollLeft;
      this.scrollTop = optionsOrX.top ?? this.scrollTop;
    }
    queueMicrotask(() => this.dispatchEvent(new Event('scroll')));
  };
}
