'use client';

import { Checkbox } from '@elirobinson/react/components/atoms/Checkbox';

export default function HiddenLabel() {
  return (
    <div className="demo-row">
      <Checkbox label="Select invoice 1042" hideLabel />
      <span>Invoice 1042</span>
    </div>
  );
}
