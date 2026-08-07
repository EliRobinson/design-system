'use client';

import { Stepper } from '@elirobinson/react/components/molecules/Stepper';

const steps = [{ label: 'Cart' }, { label: 'Shipping' }, { label: 'Payment' }, { label: 'Review' }];

export default function Basic() {
  return <Stepper steps={steps} activeStep={2} />;
}
