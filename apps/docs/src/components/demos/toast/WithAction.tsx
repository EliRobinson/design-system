'use client';

import { useState } from 'react';
import {
  Toast,
  ToastAction,
  ToastDescription,
  ToastTitle,
} from '@elirobinson/react/components/organisms/Toast';

export default function WithAction() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return <p className="t-body">Dismissed — refresh the page to bring it back.</p>;
  }

  return (
    <Toast onDismiss={() => setDismissed(true)}>
      <ToastTitle>Guide removed from cart</ToastTitle>
      <ToastDescription>Basketball Conditioning was taken out of your order.</ToastDescription>
      <ToastAction onClick={() => setDismissed(true)}>Undo</ToastAction>
    </Toast>
  );
}
