'use client';

import { Spinner } from '@elirobinson/react/components/atoms/Spinner';

export default function Sizes() {
  return (
    <div className="demo-row">
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  );
}
