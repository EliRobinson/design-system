'use client';

import { RadioGroup, RadioGroupItem } from '@elirobinson/react/components/atoms/RadioGroup';

export default function Basic() {
  return (
    <RadioGroup name="plan" defaultValue="pro">
      <RadioGroupItem value="free" label="Free" />
      <RadioGroupItem value="pro" label="Pro" />
      <RadioGroupItem value="enterprise" label="Enterprise" />
    </RadioGroup>
  );
}
