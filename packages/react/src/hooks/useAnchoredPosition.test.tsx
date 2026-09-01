import { useRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { placeAt, stubAnchoredGeometry } from '../test/anchoredGeometry.js';
import type { AnchoredPositionOptions } from './useAnchoredPosition.js';
import { useAnchoredPosition } from './useAnchoredPosition.js';

/* jsdom's viewport, which nothing here overrides. */
const VIEWPORT_HEIGHT = 768;
const VIEWPORT_WIDTH = 1024;

/* The gap the hook leaves between a trigger and its panel. */
const GAP = 4;

const PANEL = { width: 180, height: 200 };

function Anchored({
  options,
  trigger,
  panel = PANEL,
  open = true,
}: {
  options?: AnchoredPositionOptions;
  trigger: { top: number; left: number; width: number; height: number };
  panel?: { width: number; height: number };
  open?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /* Boxes are assigned in ref callbacks rather than during render: React
     attaches refs before it runs layout effects in the same commit, so the
     geometry is in place by the time the hook measures it. Assigning during
     render is a commit too late — the refs are still null on the first pass,
     and the effect's deps do not change on a second, so it never re-measures. */
  const measureTrigger = (node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    if (node) placeAt(node, trigger);
  };
  const measurePanel = (node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (node) placeAt(node, { top: 0, left: 0, ...panel });
  };

  useAnchoredPosition(open, triggerRef, contentRef, options);

  return (
    <>
      <button ref={measureTrigger} data-testid="trigger" />
      <div ref={measurePanel} data-testid="panel" />
    </>
  );
}

function anchor(props: Parameters<typeof Anchored>[0]) {
  return render(<Anchored {...props} />).getByTestId('panel');
}

describe('useAnchoredPosition', () => {
  stubAnchoredGeometry();

  describe('flipping to the side that fits', () => {
    it('hangs below the trigger when the panel fits there', () => {
      const panel = anchor({ trigger: { top: 100, left: 40, width: 120, height: 40 } });

      expect(panel.style.top).toBe(`${140 + GAP}px`);
      expect(panel.style.bottom).toBe('auto');
    });

    it('flips above the trigger when the panel does not fit below', () => {
      /* 24px of room below, 700 above, for a 200px panel. */
      const panel = anchor({ trigger: { top: 700, left: 40, width: 120, height: 40 } });

      expect(panel.style.bottom).toBe(`${VIEWPORT_HEIGHT - 700 + GAP}px`);
      expect(panel.style.top).toBe('auto');
    });

    it('stays on the bottom edge when neither side has room', () => {
      /* A panel taller than the viewport fits nowhere, so there is no better
         side to flip to. It stays hung from the trigger's bottom edge — which
         is what `bottom: auto` says — and the shift pass below is what then
         decides where along the axis that leaves it. */
      const panel = anchor({
        trigger: { top: 400, left: 40, width: 120, height: 40 },
        panel: { width: 180, height: 900 },
      });

      expect(panel.style.bottom).toBe('auto');
    });

    it('flips a start-aligned panel to its end edge when it overruns the right', () => {
      /* Left edge at 900 leaves 124px for a 180px panel; pinning the right
         edge to the trigger's leaves 960. */
      const panel = anchor({ trigger: { top: 100, left: 900, width: 60, height: 40 } });

      expect(panel.style.right).toBe(`${VIEWPORT_WIDTH - 960}px`);
      expect(panel.style.left).toBe('auto');
    });

    it('leaves a centred panel alone, which is what a tooltip wants', () => {
      /* Centring is symmetric, so there is no opposite edge to flip to. */
      const panel = anchor({
        options: { align: 'center' },
        trigger: { top: 100, left: 900, width: 60, height: 40 },
      });

      expect(panel.style.left).toBe(`${900 + 30}px`);
      expect(panel.style.transform).toBe('translateX(-50%)');
    });

    it('keeps the trigger-width floor after flipping to the end edge', () => {
      const panel = anchor({ trigger: { top: 100, left: 900, width: 60, height: 40 } });

      expect(panel.style.minWidth).toBe('max(var(--anchored-min-width, 0px), 60px)');
    });
  });

  /* The latch is the reason this hook can measure at all. A decision free to
     move both ways would be re-made on every scroll event against a
     measurement its own last move changed — the oscillation #195 flagged as
     the open question. These two tests are what pin it one-way. */
  describe('latching, so a flip cannot oscillate', () => {
    it('stays flipped after scrolling back to where the preferred side fits', () => {
      const view = render(<Anchored trigger={{ top: 700, left: 40, width: 120, height: 40 }} />);
      const panel = view.getByTestId('panel');
      expect(panel.style.top).toBe('auto');

      /* The trigger scrolls up the page: there is room below it again. */
      placeAt(view.getByTestId('trigger'), { top: 100, left: 40, width: 120, height: 40 });
      fireEvent.scroll(window);

      /* `top: auto` is the latch: the panel is still hung from the trigger's
         top edge rather than re-deciding now that below fits again. The offset
         is the shift pass's, not the anchor's — hanging a 200px panel above a
         trigger 100px down the page would put it 104px past the top of the
         viewport, and shift is what pulls it back to flush. */
      expect(panel.style.top).toBe('auto');
      expect(panel.style.bottom).toBe(`${VIEWPORT_HEIGHT - 200}px`);
    });

    it('starts over on the next open, rather than inheriting the last one', () => {
      const trigger = { top: 700, left: 40, width: 120, height: 40 };
      const view = render(<Anchored open trigger={trigger} />);
      expect(view.getByTestId('panel').style.top).toBe('auto');

      view.rerender(<Anchored open={false} trigger={trigger} />);
      view.rerender(<Anchored open trigger={{ top: 100, left: 40, width: 120, height: 40 }} />);

      expect(view.getByTestId('panel').style.top).toBe(`${140 + GAP}px`);
    });
  });

  /* Shift is this hook's answer to "fits on neither side", where flip has
     nowhere better to go. The panel keeps its width floor and slides along the
     axis until it is inside the viewport, instead of being left half off the
     edge. Unlike flip it is never latched: the space beside a trigger changes
     with every scroll, so the offset is recomputed each pass. */
  describe('shifting a panel that fits on neither side', () => {
    /* 724px of room right of the trigger's left edge, 420 back to its right
       edge, for an 800px panel: neither alignment fits, so flip declines. */
    const wide = {
      trigger: { top: 100, left: 300, width: 120, height: 40 },
      panel: { width: 800, height: 200 },
    } as const;

    it('slides a start-aligned panel back inside the right edge', () => {
      const panel = anchor({ ...wide });

      expect(panel.style.left).toBe(`${VIEWPORT_WIDTH - 800}px`);
      expect(panel.style.right).toBe('auto');
    });

    it('keeps the trigger-width floor while shifted, rather than narrowing', () => {
      const panel = anchor({ ...wide });

      expect(panel.style.minWidth).toBe('max(var(--anchored-min-width, 0px), 120px)');
      expect(panel.style.maxWidth).toBe('');
    });

    it('slides an end-aligned panel back inside the left edge', () => {
      /* 924px of room back from the trigger's right edge is still short of a
         950px panel, and the 220px in front of it is shorter still. */
      const panel = anchor({
        options: { align: 'end' },
        trigger: { top: 100, left: 100, width: 120, height: 40 },
        panel: { width: 950, height: 200 },
      });

      expect(panel.style.right).toBe(`${VIEWPORT_WIDTH - 950}px`);
      expect(panel.style.left).toBe('auto');
    });

    it('slides a centred panel, which has no flip of its own to fall back on', () => {
      /* Centred on 1000, a 180px panel would end at 1090. */
      const panel = anchor({
        options: { align: 'center' },
        trigger: { top: 100, left: 980, width: 40, height: 40 },
      });

      expect(panel.style.left).toBe(`${VIEWPORT_WIDTH - 90}px`);
      expect(panel.style.transform).toBe('translateX(-50%)');
    });

    it('slides a panel that fits neither above nor below up inside the viewport', () => {
      /* 374px below the trigger and 346 above it, for a 500px panel. */
      const panel = anchor({
        trigger: { top: 350, left: 40, width: 120, height: 40 },
        panel: { width: 180, height: 500 },
      });

      expect(panel.style.top).toBe(`${VIEWPORT_HEIGHT - 500}px`);
      expect(panel.style.bottom).toBe('auto');
    });

    it('scrolls a panel taller than the viewport instead of sliding it', () => {
      /* The one case shifting cannot rescue: no offset makes a 900px panel fit
         in 768px of viewport. */
      const panel = anchor({
        trigger: { top: 400, left: 40, width: 120, height: 40 },
        panel: { width: 180, height: 900 },
      });

      expect(panel.style.maxHeight).toBe(`${VIEWPORT_HEIGHT}px`);
      expect(panel.style.overflowY).toBe('auto');
      expect(panel.style.top).toBe('0px');
    });

    it('leaves the height alone for a panel that fits', () => {
      const panel = anchor({ trigger: { top: 100, left: 40, width: 120, height: 40 } });

      expect(panel.style.maxHeight).toBe('');
      expect(panel.style.overflowY).toBe('');
    });

    it('lands in the same place on every reposition, with no drift', () => {
      /* The shift is a function of the current rects alone, never of the
         offset the last pass wrote, so repositioning cannot walk the panel
         across the screen the way a flip free to move both ways could. */
      const view = render(
        <Anchored
          trigger={{ top: 350, left: 300, width: 120, height: 40 }}
          panel={{ width: 800, height: 500 }}
        />,
      );
      const panel = view.getByTestId('panel');
      const placed = { left: panel.style.left, top: panel.style.top };

      fireEvent.scroll(window);
      fireEvent.scroll(window);
      fireEvent(window, new Event('resize'));

      expect(placed).toEqual({
        left: `${VIEWPORT_WIDTH - 800}px`,
        top: `${VIEWPORT_HEIGHT - 500}px`,
      });
      expect({ left: panel.style.left, top: panel.style.top }).toEqual(placed);
    });
  });
});
