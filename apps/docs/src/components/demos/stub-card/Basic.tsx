'use client';

import { StubCard } from '@elirobinson/react/components/molecules/StubCard';

export default function Basic() {
  return (
    <StubCard
      title="Annual maintenance plan"
      items={[
        { label: 'Plan', value: 'Standard, one unit' },
        { label: 'Starts', value: 'March 1' },
        { label: 'Billing', value: 'Once a year' },
      ]}
      stubLabel="Due today"
      stubValue="$480"
      stubCaption="Renews March 1"
      footnote="Nothing is charged until you confirm."
    />
  );
}
