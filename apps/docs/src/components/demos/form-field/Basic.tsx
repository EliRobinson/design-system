'use client';

import { FormField } from '@elirobinson/react/components/molecules/FormField';

export default function Basic() {
  return (
    <FormField label="Studio name" htmlFor="studio-name" hint="Shown on client invoices.">
      {(fieldProps) => <input id="studio-name" className="ds-input" {...fieldProps} />}
    </FormField>
  );
}
