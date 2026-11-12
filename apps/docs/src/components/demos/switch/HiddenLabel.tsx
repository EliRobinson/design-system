'use client';

import { Switch } from '@elirobinson/react/components/atoms/Switch';

export default function HiddenLabel() {
  return (
    <div className="demo-row">
      <span>Weekly digest</span>
      <Switch label="Weekly digest" hideLabel />
    </div>
  );
}
