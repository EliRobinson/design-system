'use client';

import { Separator } from '@elirobinson/react/components/atoms/Separator';

export default function Vertical() {
  return (
    <div className="demo-row" style={{ height: 44 }}>
      <span>Portfolio</span>
      <Separator orientation="vertical" />
      <span>Store</span>
    </div>
  );
}
