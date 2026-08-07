'use client';

import { Progress } from '@elirobinson/react/components/atoms/Progress';

export default function Basic() {
  return (
    <div className="demo-col">
      <Progress value={65} label="Import progress" />
    </div>
  );
}
