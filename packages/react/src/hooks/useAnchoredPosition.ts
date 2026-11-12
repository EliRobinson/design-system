import type { RefObject } from 'react';
import { useLayoutEffect, useRef } from 'react';

export type AnchoredSide = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';

export type AnchoredPositionOptions = {
  /**
   * Which edge of the trigger the panel hangs from. Default `'bottom'`.
   * `'left'` and `'right'` hang it beside the trigger, which is what a narrow
   * vertical rail wants; `align` then lines the panel up on the *vertical*
   * axis — `'start'` with the trigger's top edge, `'end'` with its bottom edge,
   * `'center'` on its middle — and no trigger-width floor is written.
   */
  side?: AnchoredSide;
  /**
   * `'start'` lines the panel's left edge up with the trigger's and gives it
   * the trigger's width as a minimum — the menu/listbox shape. `'end'` is the
   * same shape mirrored: the panel's *right* edge is pinned to the trigger's,
   * which is what a trigger near the right edge of the viewport needs.
   * `'center'` centres it on the trigger and leaves the width to the content,
   * which is what a tooltip wants. Default `'start'`.
   */
  align?: Align;
  /** CSS `z-index` value written onto the panel. Default `var(--z-overlay)`. */
  zIndex?: string;
};

/** The single gap between a trigger and anything anchored to it. */
const GAP = 4;

const OPPOSITE_ALIGN: Record<Align, Align> = { start: 'end', end: 'start', center: 'center' };

/** An end of an axis: `start` is nearer the viewport's origin. */
type Edge = 'start' | 'end';

const OPPOSITE_EDGE: Record<Edge, Edge> = { start: 'end', end: 'start' };

/**
 * The inline `min-width` for a start/end-aligned panel.
 *
 * "At least as wide as its trigger" is a floor, but an inline declaration
 * outranks the stylesheet, so writing the trigger's width here on its own
 * *deleted* the panel's own `min-width` — an icon or avatar trigger took
 * `.ds-dropdown__content`'s 180px down to 40px (#180).
 *
 * The number stays in CSS. A panel that wants a floor sets
 * `--anchored-min-width` beside its `min-width`, and `max()` resolves the two
 * in the browser; a panel that sets no floor falls back to `0px` and is sized
 * by its trigger exactly as before.
 */
function minWidthFor(triggerWidth: number) {
  return `max(var(--anchored-min-width, 0px), ${triggerWidth}px)`;
}

/**
 * Slides one pinned offset along its axis until the panel is inside the
 * viewport, and returns the offset to write.
 *
 * `offset` is the distance from the viewport edge the panel hangs off — a
 * `left`, a `right`, a `top`, a `bottom` — so the panel occupies
 * `offset` through `offset + size`, and the whole of it is on screen exactly
 * when `0 <= offset <= viewport - size`. Shifting is that clamp and nothing
 * more: the panel moves, it is never resized, so the width floor above and
 * the panel's own content width both survive it untouched.
 *
 * Unlike the flip above this cannot be latched, and does not need to be. Flip
 * is a choice between two placements, so leaving it free to change its mind
 * lets it chase a threshold it is sitting on. A shift is not a choice — it is
 * a function of the geometry in front of it, with no memory of the offset the
 * last pass wrote. Feed it the same rects and it returns the same answer, so
 * repositioning on every scroll event cannot walk the panel anywhere.
 *
 * The one feedback loop it does have is benign. A shrink-to-fit panel widens
 * when it is given more room, and shifting only ever gives it more room, so
 * across passes the measured width can only grow and the offset can only
 * fall — monotonic, bounded below by 0, and settled the moment the panel is
 * rendering at its natural width.
 *
 * `viewport - size` goes negative for a panel bigger than the viewport, and
 * the `max` then pins it flush against the edge it was already anchored to.
 */
function shiftIntoView(offset: number, size: number, viewport: number) {
  return Math.max(0, Math.min(offset, viewport - size));
}

/**
 * One screen axis, named so the placement below is written once for both. A
 * top/bottom panel runs its main axis along `Y` and its cross axis along `X`;
 * a left/right panel is the transpose.
 */
type Axis = {
  /** The edge nearer the viewport's origin, and the one further from it. */
  start: 'left' | 'top';
  end: 'right' | 'bottom';
  /** The other axis: the cross axis of a panel whose main axis this is. */
  cross: () => Axis;
  size: 'width' | 'height';
  viewport: 'innerWidth' | 'innerHeight';
  translate: 'translateX' | 'translateY';
};

const X: Axis = {
  start: 'left',
  end: 'right',
  size: 'width',
  viewport: 'innerWidth',
  translate: 'translateX',
  cross: () => Y,
};
const Y: Axis = {
  start: 'top',
  end: 'bottom',
  size: 'height',
  viewport: 'innerHeight',
  translate: 'translateY',
  cross: () => X,
};

/** The main axis each side hangs the panel along, and which end of it. */
const SIDE: Record<AnchoredSide, { axis: Axis; edge: Edge }> = {
  top: { axis: Y, edge: 'start' },
  bottom: { axis: Y, edge: 'end' },
  left: { axis: X, edge: 'start' },
  right: { axis: X, edge: 'end' },
};

/**
 * Pins one edge of the panel `offset` in from the same edge of the viewport,
 * shifted into view, and releases the other edge to `auto`: a fixed box given
 * both is stretched between them rather than sized by its content.
 */
function pin(content: HTMLElement, axis: Axis, edge: Edge, offset: number, size: number) {
  const released = edge === 'start' ? axis.end : axis.start;
  content.style[axis[edge]] = `${shiftIntoView(offset, size, window[axis.viewport])}px`;
  content.style[released] = 'auto';
}

/**
 * Hangs the panel a gap off the trigger's `edge` along the main axis. Off the
 * end edge (`bottom`, `right`) its start edge is pinned; off the start edge
 * (`top`, `left`) its end edge is, measured back from the viewport.
 */
function placeOnMainAxis(
  content: HTMLElement,
  axis: Axis,
  edge: Edge,
  rect: DOMRect,
  panel: DOMRect,
) {
  const size = panel[axis.size];
  if (edge === 'end') {
    pin(content, axis, 'start', rect[axis.end] + GAP, size);
  } else {
    pin(content, axis, 'end', window[axis.viewport] - rect[axis.start] + GAP, size);
  }
}

/** Lines the panel up with the trigger along the cross axis. */
function placeOnCrossAxis(
  content: HTMLElement,
  axis: Axis,
  align: Align,
  rect: DOMRect,
  panel: DOMRect,
) {
  const size = panel[axis.size];
  if (align === 'center') {
    /* Shifting is stated in terms of the edge that is on screen or not, so the
       centre is taken apart into a start edge, shifted, and put back together:
       the translate is still what does the centring. */
    const centred = rect[axis.start] + rect[axis.size] / 2;
    const shifted = shiftIntoView(centred - size / 2, size, window[axis.viewport]);
    content.style[axis.start] = `${shifted + size / 2}px`;
    content.style[axis.end] = 'auto';
    content.style.transform = `${axis.translate}(-50%)`;
    return;
  }
  if (align === 'end') {
    // Measured back from the same viewport size the main axis measures
    // against: a classic scrollbar makes `innerWidth` a few pixels generous,
    // and one consistent frame is worth more than two subtly different ones.
    pin(content, axis, 'end', window[axis.viewport] - rect[axis.end], size);
  } else {
    pin(content, axis, 'start', rect[axis.start], size);
  }
  content.style.transform = '';
}

/**
 * Positions a floating panel against its trigger with `position: fixed`, and
 * keeps it there while the page scrolls or the window resizes.
 *
 * Geometry is written straight to the node's inline style rather than held in
 * state: this runs in a layout effect, before paint, so the panel never shows
 * up in the wrong place first. The fourth argument accepts a bare side for the
 * common case (`'top'`, `'bottom'`, `'left'` or `'right'`) or an options object.
 *
 * A panel that does not fit on the side it asked for flips to the opposite one
 * — `bottom` to `top`, `left` to `right`, `start` to `end` — provided the opposite side has room.
 * Each axis flips at most once per open and never flips back, so the panel
 * cannot chase a threshold it is sitting on; `align: 'center'` is symmetric and
 * never flips. A panel that fits on *neither* side is shifted instead: it keeps
 * its width and slides along the axis until it is inside the viewport, so it
 * stops being edge-aligned with its trigger, and may overlap it, but it is
 * never narrowed into the room left beside a pinned edge and never reflows.
 * Only a panel taller than the viewport fits at no offset at all; that one
 * takes a `max-height` of the viewport and scrolls its own content.
 *
 * (The docs site renders the three paragraphs above and stops, so anything
 * a consumer has to know belongs there rather than here.)
 *
 * Shifting rather than clamping is the decision #195 asked for, and it is
 * decided by what a clamp would do: a `position: fixed` panel with no width is
 * shrink-to-fit, so capping its width does not crop it — it reflows the
 * content and wraps the labels, which is the squeeze #180 reported and reads
 * as a styling bug rather than a positioning one. Moving the panel sidesteps
 * the overflow-versus-wrap tradeoff entirely; the width floor `minWidthFor`
 * writes survives a shift untouched, because a shift resizes nothing. Unlike
 * the flip it is never latched — see `shiftIntoView` for why it does not need
 * to be, and why recomputing it on every reposition cannot walk the panel
 * across the screen. The one thing it cannot rescue horizontally is a panel
 * wider than the viewport, which is left flush against the edge it was pinned
 * to and overflows the other, because narrowing it is exactly what the floor
 * exists to prevent.
 *
 * The shift is measured from the panel's rendered box, and the pass is ordered
 * so that box is worth measuring — see the `position: fixed` written ahead of
 * the read. Every offset it then writes leaves the panel room for the width it
 * measured, so a panel placed by this hook is not squeezed into wrapping by
 * where it was put. What it cannot see is a panel that resizes itself while it
 * is open: nothing observes that, and it is corrected on the next scroll or
 * resize like everything else here.
 */
export function useAnchoredPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  options: AnchoredSide | AnchoredPositionOptions = 'bottom',
) {
  const resolved = typeof options === 'string' ? { side: options } : options;
  const { side = 'bottom', align = 'start', zIndex = 'var(--z-overlay)' } = resolved;

  /* Each axis flips at most once, away from a side that does not fit and never
     back. That is what keeps a measure-then-reposition pass from oscillating:
     flipping changes the very measurement that caused it, so a decision free to
     move both ways can chase itself every frame at the threshold. One-way, the
     loop cannot close — and once an axis has settled there is nothing left to
     decide, so the measurement stops mattering. */
  const flippedSide = useRef(false);
  const flippedAlign = useRef(false);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    flippedSide.current = false;
    flippedAlign.current = false;

    function position() {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) {
        return;
      }

      /* The one declaration written before the measurement, because it decides
         what is being measured. A portalled panel that has not been positioned
         yet is a block-level box as wide as the body it was appended to, and
         every "does it fit?" question answered against that width answers
         wrong — a shift computed from it would drag every panel to the edge of
         the viewport on its first paint. Fixed, and with neither offset set
         yet, the panel is shrink-to-fit at its static position: its natural
         width, up to the viewport. On every later pass the property already
         holds this value, so nothing is invalidated and the read below flushes
         the same single layout it would have flushed anyway. */
      content.style.position = 'fixed';

      const rect = trigger.getBoundingClientRect();
      const panel = content.getBoundingClientRect();

      /* Read before any write of geometry. Both boxes are measured up front,
         and measuring them after writing offsets would read back what this
         pass had just set. */
      const { axis: main, edge } = SIDE[side];
      const cross = main.cross();
      /* Room along the main axis beyond the trigger's start edge or end edge,
         less the gap, keyed by the edge the panel hangs off. */
      const room: Record<Edge, number> = {
        start: rect[main.start] - GAP,
        end: window[main.viewport] - rect[main.end] - GAP,
      };

      /* Room along the cross axis, measured from the trigger's start edge
         forwards or its end edge backwards, keyed by the alignment that uses it. */
      const alignRoom: Record<Edge, number> = {
        start: window[cross.viewport] - rect[cross.start],
        end: rect[cross.end],
      };

      if (!flippedSide.current) {
        const preferred = room[edge];
        const opposite = room[OPPOSITE_EDGE[edge]];
        const size = panel[main.size];
        /* Only worth flipping if the other side is actually better. A panel
           that fits nowhere stays where it was asked to go. */
        flippedSide.current = size > preferred && size <= opposite;
      }

      /* Centring is symmetric — there is no opposite edge to pin instead — so
         a tooltip is left exactly where it was. */
      if (align !== 'center' && !flippedAlign.current) {
        const preferred = alignRoom[align];
        const opposite = alignRoom[align === 'start' ? 'end' : 'start'];
        const size = panel[cross.size];
        flippedAlign.current = size > preferred && size <= opposite;
      }

      /* `flippedAlign` only ever latches on a start/end panel, so the centred
         case needs no guard here. */
      const effectiveEdge = flippedSide.current ? OPPOSITE_EDGE[edge] : edge;
      const effectiveAlign: Align = flippedAlign.current ? OPPOSITE_ALIGN[align] : align;

      content.style.zIndex = zIndex;

      placeOnMainAxis(content, main, effectiveEdge, rect, panel);
      placeOnCrossAxis(content, cross, effectiveAlign, rect, panel);
      // The menu/listbox shape: at least as wide as its trigger. Beside the
      // trigger the cross axis is vertical, so there is no width to match.
      if (cross === X && effectiveAlign !== 'center') {
        content.style.minWidth = minWidthFor(rect.width);
      }

      /* The one case no offset can rescue, so the only case that gets a clamp.
         Both properties are written on every pass — cleared to `''` rather
         than left behind — so a panel that grows past the viewport and shrinks
         back again gets its own stylesheet's height rules returned to it.

         `>=`, not `>`, is what keeps the clamp from fighting the shift. The
         next pass measures the box this one produced, and that box is exactly
         `innerHeight` tall: read as `>` it would count as fitting, be released,
         spring back to its full height, and be clamped again on the pass after
         — the same oscillation the flip latch exists to prevent, arrived at
         from the other direction. Clamping to the viewport exactly, and
         treating the clamped height as still too tall, makes the panel its own
         fixed point. */
      const tallerThanViewport = panel.height >= window.innerHeight;
      content.style.maxHeight = tallerThanViewport ? `${window.innerHeight}px` : '';
      content.style.overflowY = tallerThanViewport ? 'auto' : '';
    }

    position();

    // Fixed positioning is measured against the viewport, so any scroll or
    // resize invalidates it. Scroll is captured because the trigger may sit in
    // a scrollable ancestor, which does not bubble a scroll event to window.
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [open, triggerRef, contentRef, side, align, zIndex]);
}
