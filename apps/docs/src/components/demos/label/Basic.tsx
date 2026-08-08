'use client';

import { Label } from '@elirobinson/react/components/atoms/Label';
import { RadioGroup, RadioGroupItem } from '@elirobinson/react/components/atoms/RadioGroup';

export default function Basic() {
  return (
    <div className="demo-col">
      <Label id="plan-label">Coaching plan</Label>
      <RadioGroup name="plan" defaultValue="monthly" aria-labelledby="plan-label">
        <RadioGroupItem value="single" label="Single session" />
        <RadioGroupItem value="monthly" label="Monthly plan" />
        <RadioGroupItem value="season" label="Full season" />
      </RadioGroup>
    </div>
  );
}
