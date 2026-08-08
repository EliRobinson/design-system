'use client';

import { Stepper } from '@elirobinson/react/components/molecules/Stepper';

const steps = [{ label: 'Account' }, { label: 'Studio details' }, { label: 'Invite clients' }];

export default function Progress() {
  return (
    <div className="demo-col">
      <Stepper steps={steps} activeStep={1} />
      <Stepper steps={steps} activeStep={2} />
      <Stepper steps={steps} activeStep={3} />
    </div>
  );
}
