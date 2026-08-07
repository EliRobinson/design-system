'use client';

import { Progress } from '@elirobinson/react/components/atoms/Progress';

export default function States() {
  return (
    <div className="demo-col">
      <Progress value={20} label="Warm-up drills" />
      <Progress value={65} label="Skills circuit" />
      <Progress value={100} label="Cooldown" />
      <Progress value={3} max={5} label="Modules complete" />
    </div>
  );
}
