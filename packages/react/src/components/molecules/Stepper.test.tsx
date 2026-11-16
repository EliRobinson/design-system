import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Stepper } from './Stepper.js';

const steps = [{ label: 'Cart' }, { label: 'Address' }, { label: 'Pay' }];

/* The drawn check is aria-hidden, so a completed step has to say it is
   complete in text, or it reads the same as an upcoming one (#308). */
describe('Stepper', () => {
  it('says "Completed" in each completed step, and only there', () => {
    render(<Stepper steps={steps} activeStep={2} />);
    const [cart, address, pay] = screen.getAllByRole('listitem');

    expect(cart).toHaveTextContent(/^Completed\s*Cart$/);
    expect(address).toHaveTextContent(/^2\s*Address$/);
    expect(pay).toHaveTextContent(/^3\s*Pay$/);
  });

  it('keeps the completed text visually hidden', () => {
    render(<Stepper steps={steps} activeStep={2} />);

    expect(screen.getByText('Completed')).toHaveClass('ds-visually-hidden');
  });

  it('uses completedLabel in place of the default word', () => {
    render(<Stepper steps={steps} activeStep={3} completedLabel="Terminé" />);

    expect(screen.getAllByText('Terminé')).toHaveLength(2);
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('marks only the active step as the current one', () => {
    render(<Stepper steps={steps} activeStep={2} />);
    const [cart, address, pay] = screen.getAllByRole('listitem');

    expect(address).toHaveAttribute('aria-current', 'step');
    expect(cart).not.toHaveAttribute('aria-current');
    expect(pay).not.toHaveAttribute('aria-current');
  });
});
