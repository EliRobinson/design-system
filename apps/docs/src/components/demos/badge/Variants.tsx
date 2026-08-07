'use client';

import { Badge } from '@elirobinson/react/components/atoms/Badge';

export default function Variants() {
  return (
    <div className="demo-row">
      <Badge variant="default">Guide</Badge>
      <Badge variant="signal">Featured</Badge>
      <Badge variant="anchor">Coaching</Badge>
      <Badge variant="solid">New</Badge>
      <Badge variant="outline">Beta</Badge>
    </div>
  );
}
