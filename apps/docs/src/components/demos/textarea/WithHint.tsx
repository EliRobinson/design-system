'use client';

import { Textarea } from '@elirobinson/react/components/atoms/Textarea';

export default function WithHint() {
  return (
    <Textarea
      label="Message"
      placeholder="Tell me what you need help with…"
      hint="Aim for 2–3 sentences — I'll follow up with questions."
    />
  );
}
