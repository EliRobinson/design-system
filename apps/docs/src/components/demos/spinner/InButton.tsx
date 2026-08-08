'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';
import { Spinner } from '@elirobinson/react/components/atoms/Spinner';

export default function InButton() {
  return (
    <Button disabled>
      <Spinner size="sm" aria-hidden="true" />
      Saving changes
    </Button>
  );
}
