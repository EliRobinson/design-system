'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';

export default function States() {
  return (
    <div className="demo-row">
      <Button disabled>Disabled</Button>
      <Button variant="secondary" disabled>
        Disabled secondary
      </Button>
    </div>
  );
}
