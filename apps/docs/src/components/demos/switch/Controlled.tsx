'use client';

import { useState } from 'react';

import { Switch } from '@elirobinson/react/components/atoms/Switch';

export default function Controlled() {
  const [autoRenew, setAutoRenew] = useState(true);

  return (
    <div className="demo-col">
      <Switch
        label="Auto-renew"
        checked={autoRenew}
        onChange={(event) => setAutoRenew(event.target.checked)}
      />
      <p>{autoRenew ? 'Your plan renews automatically.' : 'Your plan ends after this period.'}</p>
    </div>
  );
}
