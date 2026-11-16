import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';
import { Mark } from '../../lib/marks.js';

export type StepperStep = {
  label: string;
};

export type StepperProps = HTMLAttributes<HTMLOListElement> & {
  steps: StepperStep[];
  activeStep: number;
  /** Read out before a completed step's label, in place of the drawn check. Defaults to "Completed". */
  completedLabel?: string;
};

export const Stepper = forwardRef<HTMLOListElement, StepperProps>(function Stepper(
  { className, steps, activeStep, completedLabel = 'Completed', ...props },
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
            <span className="ds-stepper__indicator">
              {isComplete ? (
                <>
                  {/* The mark is aria-hidden, so the step's state is said in words. */}
                  <Mark name="check" />
                  <span className="ds-visually-hidden">{completedLabel}</span>
                </>
              ) : (
                stepNumber
              )}
            </span>
            <span className="ds-stepper__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
});
