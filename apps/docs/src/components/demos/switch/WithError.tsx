'use client';

import { Switch } from '@elirobinson/react/components/atoms/Switch';

export default function WithError() {
  return <Switch label="Email notifications" error="Not saved. Try again." />;
}
