'use client';

import { DecisionCard } from '@elirobinson/react/components/molecules/DecisionCard';

export default function NoAction() {
  return (
    <DecisionCard
      verdict="no"
      verdictLabel="Skip it"
      subject="Extended device coverage"
      headline="The coverage costs more than the repair it protects you from."
      figures={[
        { label: 'Coverage', value: '$240', kind: 'cost' },
        { label: 'Screen repair', value: '$150', kind: 'cost' },
        { label: 'Deductible', value: '$79', kind: 'cost' },
      ]}
      total={{ label: 'Cost over two years', value: '$240' }}
      contrast={{ label: 'One out-of-pocket repair', value: '$150' }}
      caveat="A second repair inside the term would change this."
      closing="I'd skip it and put the $240 toward the replacement instead."
    />
  );
}
