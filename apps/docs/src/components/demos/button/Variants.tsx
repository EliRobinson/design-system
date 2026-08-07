'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';

export default function Variants() {
  return (
    <div className="demo-row">
      <Button variant="primary">Primary</Button>
      <Button variant="accent">Accent</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  );
}
