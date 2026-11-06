'use client';

import { Checkbox } from '@elirobinson/react/components/atoms/Checkbox';
import { FieldError } from '@elirobinson/react/components/atoms/FieldError';
import { Label } from '@elirobinson/react/components/atoms/Label';

export default function Basic() {
  return (
    <div
      className="demo-col"
      role="group"
      aria-labelledby="managers-label"
      aria-describedby="managers-error"
    >
      <Label id="managers-label">Managers</Label>
      <Checkbox label="Ada" />
      <Checkbox label="Grace" />
      <FieldError id="managers-error">Make at least 1 Manager an Admin.</FieldError>
    </div>
  );
}
