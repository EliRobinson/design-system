'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';
import { EmptyState } from '@elirobinson/react/components/molecules/EmptyState';

function SearchIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function WithAction() {
  return (
    <EmptyState
      icon={<SearchIcon />}
      title="No recipes found"
      description="Try a different ingredient, or clear your filters and start over."
      action={<Button onClick={() => alert('Filters cleared.')}>Clear filters</Button>}
    />
  );
}
