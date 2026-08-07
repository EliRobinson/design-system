import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}

if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

// jsdom has no layout engine and no ResizeObserver. @tanstack/react-virtual
// (used by VirtualList, and by Table/Combobox once they virtualize) constructs
// a ResizeObserver to measure its scroll container, and reads
// offsetHeight/clientHeight/getBoundingClientRect to size the viewport — all
// of which are undefined/zero in jsdom. Without these stubs the virtualizer
// throws "ResizeObserver is not defined" before it ever gets to compute a
// row range, and even with a stubbed observer it would measure a 0px
// viewport and render nothing.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}

const STUBBED_VIEWPORT_SIZE = 500;

for (const property of ['offsetHeight', 'offsetWidth', 'clientHeight', 'clientWidth'] as const) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    value: STUBBED_VIEWPORT_SIZE,
  });
}

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return {
    width: STUBBED_VIEWPORT_SIZE,
    height: STUBBED_VIEWPORT_SIZE,
    top: 0,
    left: 0,
    right: STUBBED_VIEWPORT_SIZE,
    bottom: STUBBED_VIEWPORT_SIZE,
    x: 0,
    y: 0,
    toJSON() {},
  } as DOMRect;
};
