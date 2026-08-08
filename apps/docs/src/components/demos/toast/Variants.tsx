'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';
import { Toaster, useToast } from '@elirobinson/react/components/organisms/Toast';
import type { ToastVariant } from '@elirobinson/react/components/organisms/Toast';

const VARIANTS: Array<{
  variant: ToastVariant;
  label: string;
  title: string;
  description: string;
}> = [
  {
    variant: 'success',
    label: 'Success',
    title: 'Invoice paid',
    description: 'Thanks — a receipt is on its way to your inbox.',
  },
  {
    variant: 'warning',
    label: 'Warning',
    title: 'Session starts soon',
    description: 'Youth Football Fundamentals begins in 15 minutes.',
  },
  {
    variant: 'danger',
    label: 'Danger',
    title: 'Payment failed',
    description: 'Your card was declined — try again or use a different card.',
  },
  {
    variant: 'info',
    label: 'Info',
    title: 'Guide updated',
    description: 'Basketball Conditioning now includes two new drills.',
  },
];

function VariantButtons() {
  const { toast } = useToast();

  return (
    <div className="demo-row">
      {VARIANTS.map(({ variant, label, title, description }) => (
        <Button
          key={variant}
          variant="secondary"
          onClick={() => toast({ title, description, variant })}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

export default function Variants() {
  return (
    <Toaster>
      <VariantButtons />
    </Toaster>
  );
}
