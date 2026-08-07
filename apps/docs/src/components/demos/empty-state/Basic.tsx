'use client';

import { EmptyState } from '@elirobinson/react/components/molecules/EmptyState';

export default function Basic() {
  return (
    <EmptyState
      title="No coaching guides yet"
      description="Guides you publish will show up here, ready to share with your team."
    />
  );
}
