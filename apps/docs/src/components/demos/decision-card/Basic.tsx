'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';
import { DecisionCard } from '@elirobinson/react/components/organisms/DecisionCard';

export default function Basic() {
  return (
    <DecisionCard
      verdict="go"
      verdictLabel="Worth it"
      subject="Annual maintenance plan"
      headline="The plan costs less than the two repairs a year this unit averages."
      figures={[
        { label: 'Plan', value: '$480', kind: 'cost' },
        { label: 'Average repair', value: '$310', kind: 'cost' },
        { label: 'Repairs covered', value: 'Unlimited', kind: 'coverage' },
      ]}
      total={{ label: 'Cost this year', value: '$480' }}
      contrast={{ label: 'Paying per repair', value: '$620' }}
      caveat="Priced for one unit. A second unit adds $180 and changes the maths."
      action={<Button variant="accent">Renew the plan</Button>}
    />
  );
}
