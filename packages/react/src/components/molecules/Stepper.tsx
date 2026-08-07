import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

export type StepperStep = {
  label: string;
};

export type StepperProps = HTMLAttributes<HTMLOListElement> & {
  steps: StepperStep[];
  activeStep: number;
};

export const Stepper = forwardRef<HTMLOListElement, StepperProps>(function Stepper(
  { className, steps, activeStep, ...props },
  ref,
) {
  return (
    <ol ref={ref} className={cn('ds-stepper', className)} {...props}>
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber < activeStep;
        const isActive = stepNumber === activeStep;

        return (
          <li
            key={step.label}
            className={cn(
              'ds-stepper__step',
              isComplete && 'ds-stepper__step--complete',
              isActive && 'ds-stepper__step--active',
            )}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="ds-stepper__indicator">{isComplete ? '✓' : stepNumber}</span>
            <span className="ds-stepper__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
});
