'use client';

import { Switch } from '@elirobinson/react/components/atoms/Switch';

export default function Disabled() {
  return (
    <div className="demo-col">
      <Switch label="Email notifications" disabled />
      <Switch label="Email notifications" disabled defaultChecked />
    </div>
  );
}
