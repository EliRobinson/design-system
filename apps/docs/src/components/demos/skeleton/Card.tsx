'use client';

import { Skeleton } from '@elirobinson/react/components/atoms/Skeleton';

export default function Card() {
  return (
    <div className="demo-col" aria-label="Loading coaching guides" role="status">
      <Skeleton style={{ height: 160 }} />
      <Skeleton style={{ height: 16, width: '80%' }} />
      <Skeleton style={{ height: 14, width: '60%' }} />
    </div>
  );
}
