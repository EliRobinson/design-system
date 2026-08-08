'use client';

import { FormField } from '@elirobinson/react/components/molecules/FormField';

export default function WithError() {
  return (
    <FormField
      label="Client email"
      htmlFor="client-email"
      error="Enter a valid email address"
      required
    >
      {(fieldProps) => (
        <input id="client-email" type="email" className="ds-input" {...fieldProps} />
      )}
    </FormField>
  );
}
