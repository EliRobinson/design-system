import { afterAll, beforeAll } from 'vitest';

const STUBBED_VIEWPORT_SIZE = 500;

const FIXED_SIZE_PROPERTIES = [
  'offsetHeight',
  'offsetWidth',
  'clientHeight',
  'clientWidth',
] as const;

/**
 * Gives elements a plausible geometry for the duration of the calling suite.
 *
 * jsdom has no layout engine: every element measures 0x0 and reports
 * `scrollHeight === 0`, so a virtualizer computes a 0px viewport, renders no
 * rows, and treats every scroll target as out of range. Only suites that
 * render a windowed list need this, so it is opt-in and self-restoring rather
 * than applied package-wide in `setup.ts` — a global geometry lie would
 * silently corrupt any future test that asserts on real layout, and would do
 * it invisibly, reporting a plausible number instead of failing.
 *
 * Call at the top level of a `describe` block.
 */
export function stubViewportLayout() {
  const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();

  function override(property: string, descriptor: PropertyDescriptor) {
    originalDescriptors.set(
      property,
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, property),
    );
    Object.defineProperty(HTMLElement.prototype, property, {
      configurable: true,
      ...descriptor,
    });
  }

  beforeAll(() => {
    for (const property of FIXED_SIZE_PROPERTIES) {
      override(property, { value: STUBBED_VIEWPORT_SIZE });
    }

    // `scrollHeight` has to track the *content*, not a constant: TanStack
    // Virtual derives its maximum scroll offset from
    // `scrollHeight - clientHeight`, so a constant here would report a
    // negative maximum and clamp every `scrollToIndex()` back to 0 — the
    // scroll would appear to happen and silently do nothing. A windowed list
    // sizes its content with an inline `height` on a single spacer child, so
    // reading that back is a faithful stand-in for what a browser would
    // compute, rather than another invented number.
    override('scrollHeight', {
      get(this: HTMLElement) {
        const spacer = this.firstElementChild as HTMLElement | null;
        const contentHeight = spacer ? Number.parseFloat(spacer.style.height) : Number.NaN;
        return Number.isFinite(contentHeight) ? contentHeight : STUBBED_VIEWPORT_SIZE;
      },
    });

    override('getBoundingClientRect', {
      value: function getBoundingClientRect() {
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
      },
    });
  });

  afterAll(() => {
    for (const [property, descriptor] of originalDescriptors) {
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, property, descriptor);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>)[property];
      }
    }
    originalDescriptors.clear();
  });
}
