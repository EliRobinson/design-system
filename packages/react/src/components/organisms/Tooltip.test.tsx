import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { stubViewportLayout } from '../../test/viewport.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip.js';

function renderTooltip() {
  return render(
    <Tooltip>
      <TooltipTrigger>Help</TooltipTrigger>
      <TooltipContent>explanatory text</TooltipContent>
    </Tooltip>,
  );
}

describe('Tooltip', () => {
  // The tooltip is positioned from a real getBoundingClientRect, which jsdom
  // reports as 0x0 for everything. Without a plausible geometry the assertions
  // below could not tell "positioned at the origin" apart from "not positioned".
  stubViewportLayout();

  it('shows on hover and hides again on unhover', async () => {
    const user = userEvent.setup();
    renderTooltip();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.hover(screen.getByText('Help'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('explanatory text');

    await user.unhover(screen.getByText('Help'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows on keyboard focus', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip>
        <TooltipTrigger tabIndex={0}>Help</TooltipTrigger>
        <TooltipContent>explanatory text</TooltipContent>
      </Tooltip>,
    );

    await user.tab();

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('names the trigger through aria-describedby', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.hover(screen.getByText('Help'));

    expect(screen.getByText('Help')).toHaveAttribute(
      'aria-describedby',
      screen.getByRole('tooltip').id,
    );
  });

  it('anchors itself to the trigger via useAnchoredPosition', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.hover(screen.getByText('Help'));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.style.position).toBe('fixed');
    expect(tooltip.style.transform).toBe('translateX(-50%)');
    /* Trigger and panel share the stub's 500x500 rect, so the 504px this would
       hang at — the trigger's bottom edge plus the shared 4px gap — is 236px
       past the end of a 768px viewport, and the tooltip is shifted back to the
       last offset it fits at. See useAnchoredPosition. */
    expect(tooltip.style.top).toBe('268px');
  });

  // Anchoring used to be a getBoundingClientRect read in the render body, so
  // nothing re-ran between renders and the tooltip stayed where it was first
  // painted while the page moved underneath it.
  it('re-anchors when the window resizes', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.hover(screen.getByText('Help'));
    const tooltip = screen.getByRole('tooltip');
    tooltip.style.top = '0px';

    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(tooltip.style.top).toBe('268px');
  });

  describe('side', () => {
    it('hangs below the trigger by default', async () => {
      const user = userEvent.setup();
      renderTooltip();

      await user.hover(screen.getByText('Help'));

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip.style.transform).toBe('translateX(-50%)');
      expect(tooltip.style.bottom).toBe('auto');
    });

    it('hangs beside the trigger with side="right"', async () => {
      const user = userEvent.setup();
      render(
        <Tooltip side="right">
          <TooltipTrigger>Help</TooltipTrigger>
          <TooltipContent>explanatory text</TooltipContent>
        </Tooltip>,
      );

      await user.hover(screen.getByText('Help'));

      const tooltip = screen.getByRole('tooltip');
      /* The stub gives trigger and panel one 500x500 box, so the panel starts
         at the trigger's right edge plus the 4px gap. */
      expect(tooltip.style.left).toBe('504px');
      expect(tooltip.style.right).toBe('auto');
      expect(tooltip.style.transform).toBe('translateY(-50%)');
    });

    it('flips side="left" to the right when there is no room', async () => {
      const user = userEvent.setup();
      render(
        <Tooltip side="left">
          <TooltipTrigger>Help</TooltipTrigger>
          <TooltipContent>explanatory text</TooltipContent>
        </Tooltip>,
      );

      await user.hover(screen.getByText('Help'));

      /* 500px of room left of the trigger minus the gap is short of a 500px
         panel, and the right has room, so it flips: the same 504px. */
      expect(screen.getByRole('tooltip').style.left).toBe('504px');
    });

    it('hangs above the trigger with side="top"', async () => {
      const user = userEvent.setup();
      render(
        <Tooltip side="top">
          <TooltipTrigger>Help</TooltipTrigger>
          <TooltipContent>explanatory text</TooltipContent>
        </Tooltip>,
      );

      await user.hover(screen.getByText('Help'));

      /* 496px above is short of 500, 264 below is too, so it stays on top. */
      expect(screen.getByRole('tooltip').style.top).toBe('auto');
    });
  });

  describe('Escape', () => {
    it('dismisses the tooltip and leaves focus on the trigger', async () => {
      const user = userEvent.setup();
      render(
        <Tooltip>
          <TooltipTrigger tabIndex={0}>Help</TooltipTrigger>
          <TooltipContent>explanatory text</TooltipContent>
        </Tooltip>,
      );

      await user.tab();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      expect(screen.getByText('Help')).toHaveFocus();
    });

    it('dismisses a tooltip opened by hover, without moving the pointer', async () => {
      const user = userEvent.setup();
      renderTooltip();

      await user.hover(screen.getByText('Help'));
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('shows again when the pointer re-enters', async () => {
      const user = userEvent.setup();
      renderTooltip();

      await user.hover(screen.getByText('Help'));
      await user.keyboard('{Escape}');
      await user.unhover(screen.getByText('Help'));
      await user.hover(screen.getByText('Help'));

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('hover and focus are separate', () => {
    it('stays open when the pointer leaves while focus remains', async () => {
      const user = userEvent.setup();
      render(
        <Tooltip>
          <TooltipTrigger tabIndex={0}>Help</TooltipTrigger>
          <TooltipContent>explanatory text</TooltipContent>
        </Tooltip>,
      );

      await user.tab();
      await user.hover(screen.getByText('Help'));
      await user.unhover(screen.getByText('Help'));

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('labelOnly', () => {
    it('leaves aria-describedby off the trigger', async () => {
      const user = userEvent.setup();
      render(
        <Tooltip labelOnly>
          <TooltipTrigger>Help</TooltipTrigger>
          <TooltipContent>explanatory text</TooltipContent>
        </Tooltip>,
      );

      await user.hover(screen.getByText('Help'));

      expect(screen.getByText('Help')).not.toHaveAttribute('aria-describedby');
    });

    it('hides the content from assistive technology', async () => {
      const user = userEvent.setup();
      render(
        <Tooltip labelOnly>
          <TooltipTrigger>Help</TooltipTrigger>
          <TooltipContent>explanatory text</TooltipContent>
        </Tooltip>,
      );

      await user.hover(screen.getByText('Help'));

      expect(screen.getByRole('tooltip', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('is off by default: describedby is set and the content is exposed', async () => {
      const user = userEvent.setup();
      renderTooltip();

      await user.hover(screen.getByText('Help'));

      expect(screen.getByText('Help')).toHaveAttribute('aria-describedby');
      expect(screen.getByRole('tooltip')).not.toHaveAttribute('aria-hidden');
    });
  });
});
