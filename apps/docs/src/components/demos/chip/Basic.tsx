'use client';

import { Chip } from '@elirobinson/react/components/molecules/Chip';

export default function Basic() {
  return (
    <div className="demo-row">
      <Chip>Coaching</Chip>
      <Chip>Recipes</Chip>
      <Chip>AI consulting</Chip>
    </div>
  );
}
