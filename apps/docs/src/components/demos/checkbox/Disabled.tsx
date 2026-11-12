'use client';

import { Checkbox } from '@elirobinson/react/components/atoms/Checkbox';

export default function Disabled() {
  return (
    <div className="demo-col">
      <Checkbox label="Subscribe to updates" disabled />
      <Checkbox label="Subscribe to updates" disabled defaultChecked />
    </div>
  );
}
