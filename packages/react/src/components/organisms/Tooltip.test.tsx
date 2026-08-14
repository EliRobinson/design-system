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
    // Bottom of the stubbed 500x500 trigger rect, plus the shared 4px gap.
    expect(tooltip.style.top).toBe('504px');
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

    expect(tooltip.style.top).toBe('504px');
  });
});
