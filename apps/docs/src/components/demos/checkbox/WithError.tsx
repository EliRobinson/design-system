'use client';

import { Checkbox } from '@elirobinson/react/components/atoms/Checkbox';

export default function WithError() {
  return <Checkbox label="I accept the terms" error="Accept the terms to continue." />;
}
