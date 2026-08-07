'use client';

import { Input } from '@elirobinson/react/components/atoms/Input';

export default function WithHint() {
  return (
    <Input
      label="Email"
      type="email"
      placeholder="you@example.com"
      hint="I'll get back to you within 24 hours."
    />
  );
}
