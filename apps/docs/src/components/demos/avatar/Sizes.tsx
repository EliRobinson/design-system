'use client';

import { Avatar } from '@elirobinson/react/components/atoms/Avatar';

export default function Sizes() {
  return (
    <div className="demo-row">
      <Avatar alt="Priya Shah" fallback="PS" size="sm" />
      <Avatar alt="Priya Shah" fallback="PS" size="md" />
      <Avatar alt="Priya Shah" fallback="PS" size="lg" />
    </div>
  );
}
