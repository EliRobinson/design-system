import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Slider } from './Slider.js';

describe('Slider', () => {
  it('renders with an associated label', () => {
    render(<Slider label="Volume" />);

    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
  });

  it('renders the same markup as before when there is no error', () => {
    const { container } = render(<Slider label="Volume" id="s" />);

    expect(container.innerHTML).toBe(
      '<div class="ds-slider"><label for="s" class="ds-slider__label">Volume</label><input id="s" class="ds-slider__input" type="range"></div>',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks the slider invalid and describes it by the error', () => {
    render(<Slider label="Volume" error="Too loud." aria-describedby="mine" />);

    const slider = screen.getByRole('slider', { name: 'Volume' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Too loud.');
    expect(slider).toHaveAttribute('aria-invalid', 'true');
    expect(slider.getAttribute('aria-describedby')).toBe(`mine ${alert.id}`);
    expect(slider).toHaveClass('ds-slider__input--error');
  });
});
