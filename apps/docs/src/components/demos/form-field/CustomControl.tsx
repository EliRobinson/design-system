'use client';

import { FormField } from '@elirobinson/react/components/molecules/FormField';

export default function CustomControl() {
  return (
    <FormField
      label="Invoice terms"
      htmlFor="invoice-terms"
      hint="How long clients have to pay once you send an invoice."
    >
      {(fieldProps) => (
        <select id="invoice-terms" className="ds-input ds-select" {...fieldProps}>
          <option value="net-15">Net 15</option>
          <option value="net-30">Net 30</option>
          <option value="due-on-receipt">Due on receipt</option>
        </select>
      )}
    </FormField>
  );
}
