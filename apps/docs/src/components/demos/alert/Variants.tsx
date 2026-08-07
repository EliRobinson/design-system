'use client';

import { Alert } from '@elirobinson/react/components/molecules/Alert';

export default function Variants() {
  return (
    <div className="demo-col">
      <Alert title="Draft saved">Your invoice draft is saved — you can finish it any time.</Alert>
      <Alert variant="success" title="Payment received">
        Invoice #1042 is marked paid. A receipt was sent to the client.
      </Alert>
      <Alert variant="warning" title="Review needed">
        Two line items are missing a rate. Fix them before sending.
      </Alert>
      <Alert variant="danger" title="Send failed">
        The invoice email bounced — double-check the client's address and try again.
      </Alert>
      <Alert variant="info" title="Heads up">
        Coaching Guides are moving to a new store next month. Your links won't change.
      </Alert>
    </div>
  );
}
