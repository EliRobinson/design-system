'use client';

import { VerdictBadge } from '@elirobinson/react/components/molecules/VerdictBadge';

export default function Basic() {
  return (
    <div className="demo-row">
      <VerdictBadge verdict="go" label="Worth it" />
      <VerdictBadge verdict="hold" label="Check first" />
      <VerdictBadge verdict="no" label="Skip it" />
    </div>
  );
}
