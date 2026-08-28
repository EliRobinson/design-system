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

    it('stays below the trigger when neither side has room', () => {
      /* A panel taller than the viewport fits nowhere; the preferred side is
         still the better answer than an arbitrary flip. */
      const panel = anchor({
        trigger: { top: 400, left: 40, width: 120, height: 40 },
        panel: { width: 180, height: 900 },
      });

      expect(panel.style.top).toBe(`${440 + GAP}px`);
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

      expect(panel.style.top).toBe('auto');
      expect(panel.style.bottom).toBe(`${VIEWPORT_HEIGHT - 100 + GAP}px`);
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
});
