'use client';

import { Input } from '@elirobinson/react/components/atoms/Input';

export default function WithError() {
  return (
    <Input
      label="Email"
      type="email"
      defaultValue="not-an-email"
      error="Enter a valid email address."
    />
  );
}
