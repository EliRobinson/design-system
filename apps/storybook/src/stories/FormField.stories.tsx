import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@design-system/react/components/atoms/Badge';
import { FormField } from '@design-system/react/components/molecules/FormField';

const meta = {
  title: 'Components/FormField',
  component: FormField,
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHint: Story = {
  args: {
    label: 'Email',
    htmlFor: 'email-hint',
    hint: "We'll never share this",
    children: (fieldProps) => <input id="email-hint" className="ds-input" {...fieldProps} />,
  },
  render: () => (
    <FormField label="Email" htmlFor="email-hint" hint="We'll never share this">
      {(fieldProps) => <input id="email-hint" className="ds-input" {...fieldProps} />}
    </FormField>
  ),
};

export const WithError: Story = {
  args: {
    label: 'Email',
    htmlFor: 'email-error',
    error: 'Enter a valid email',
    required: true,
    children: (fieldProps) => <input id="email-error" className="ds-input" {...fieldProps} />,
  },
  render: () => (
    <FormField label="Email" htmlFor="email-error" error="Enter a valid email" required>
      {(fieldProps) => <input id="email-error" className="ds-input" {...fieldProps} />}
    </FormField>
  ),
};

export const WithLabelAside: Story = {
  args: {
    label: 'Medical history',
    htmlFor: 'history-aside',
    hint: 'Carried over from the last visit. Edit anything that changed.',
    labelAside: <Badge variant="signal">Pre-populated</Badge>,
    children: (fieldProps) => (
      <textarea id="history-aside" className="ds-input ds-textarea" {...fieldProps} />
    ),
  },
  render: () => (
    <FormField
      label="Medical history"
      htmlFor="history-aside"
      hint="Carried over from the last visit. Edit anything that changed."
      labelAside={<Badge variant="signal">Pre-populated</Badge>}
    >
      {(fieldProps) => (
        <textarea id="history-aside" className="ds-input ds-textarea" {...fieldProps} />
      )}
    </FormField>
  ),
};
