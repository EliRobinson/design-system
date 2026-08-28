import { afterAll, beforeAll } from 'vitest';

/* Boxes live keyed by element, so they are dropped with the elements
   themselves when a test unmounts — nothing to reset between cases. */
const rects = new WeakMap<Element, DOMRect>();

const NOWHERE = rect({ top: 0, left: 0, width: 0, height: 0 });

function rect({
  top,
  left,
  width,
  height,
}: {
  top: number;
  left: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {},
  } as DOMRect;
}

/**
 * Lets a suite give individual elements a box.
 *
 * Anchoring is arithmetic on two rectangles — the trigger's and the panel's —
 * and jsdom has no layout engine, so both measure 0x0 and every "does it fit?"
 * question answers the same way regardless of what the test set up. A flip
 * cannot be tested at all without geometry.
 *
 * Deliberately per element rather than one constant for everything, which is
 * what `stubViewportLayout` does: the whole point here is that the trigger and
 * the panel have *different* boxes, and a stub that returned one rect for both
 * would report a panel exactly as tall as the space above it and call the
 * question answered. An element nobody positioned reads as 0x0 at the origin,
 * so a test that forgets to place something fails rather than inheriting a
 * plausible number.
 *
 * The viewport is jsdom's own 1024x768. Nothing here overrides it — a fake
 * viewport and a fake element box are two lies that have to agree, and the
 * arithmetic under test is exactly what would hide their disagreement.
 *
 * Call at the top level of a `describe` block.
 */
export function stubAnchoredGeometry() {
  let original: PropertyDescriptor | undefined;

  beforeAll(() => {
    original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: function getBoundingClientRect(this: HTMLElement) {
        return rects.get(this) ?? NOWHERE;
      },
    });
  });

  afterAll(() => {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', original);
    } else {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
    }
  });
}

/** Gives one element a box, in viewport coordinates. */
export function placeAt(
  element: Element,
  box: { top: number; left: number; width: number; height: number },
) {
  rects.set(element, rect(box));
}
