'use client';

import { Checkbox } from '@elirobinson/react/components/atoms/Checkbox';

export default function States() {
  return (
    <div className="demo-col">
      <Checkbox label="Unchecked" />
      <Checkbox label="Checked by default" defaultChecked />
      <Checkbox label="Disabled" disabled />
      <Checkbox label="Disabled and checked" disabled defaultChecked />
    </div>
  );
}
