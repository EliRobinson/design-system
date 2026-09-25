'use client';

import { Badge } from '@elirobinson/react/components/atoms/Badge';
import { FormField } from '@elirobinson/react/components/molecules/FormField';

export default function LabelAside() {
  return (
    <FormField
      label="Payment terms"
      htmlFor="payment-terms"
      hint="Copied from this client's last invoice."
      labelAside={<Badge variant="signal">Pre-filled</Badge>}
    >
      {(fieldProps) => (
        <textarea id="payment-terms" className="ds-input ds-textarea" {...fieldProps} />
      )}
    </FormField>
  );
}
