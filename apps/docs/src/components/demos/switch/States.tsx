'use client';

import { Switch } from '@elirobinson/react/components/atoms/Switch';

export default function States() {
  return (
    <div className="demo-col">
      <Switch label="Off by default" />
      <Switch label="On by default" defaultChecked />
      <Switch label="Disabled" disabled />
      <Switch label="Disabled and on" disabled defaultChecked />
    </div>
  );
}
