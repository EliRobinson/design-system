'use client';

import { Textarea } from '@elirobinson/react/components/atoms/Textarea';

export default function WithError() {
  return (
    <Textarea
      label="Message"
      placeholder="Tell me what you need help with…"
      error="Enter a message before sending."
    />
  );
}
