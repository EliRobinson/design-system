'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';
import { DecisionCard } from '@elirobinson/react/components/molecules/DecisionCard';

export default function Derivation() {
  return (
    <DecisionCard
      verdict="go"
      verdictLabel="Matches"
      code="8471.30"
      headline="Portable computer, under 10 kg"
      figureLayout="prose"
      figures={[
        { id: 'weight', label: 'from', value: 'Declared weight is 1.4 kg, under the 10 kg line' },
        { id: 'unit', label: 'from', value: 'Display, keyboard and processor are in one unit' },
        { id: 'rule', label: 'rule', value: 'Heading 8471, subheading .30: portable machines' },
      ]}
      caveat="A docking station shipped in the same box is classified on its own."
      action={<Button variant="accent">Use this code</Button>}
      style={{ maxWidth: 400 }}
    />
  );
}
