'use client';

import { useState } from 'react';
import { Button } from '@elirobinson/react/components/atoms/Button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@elirobinson/react/components/organisms/Tabs';

const STEPS = ['details', 'shipping', 'confirm'] as const;
type Step = (typeof STEPS)[number];

export default function Controlled() {
  const [step, setStep] = useState<Step>('details');
  const index = STEPS.indexOf(step);

  return (
    <div className="demo-col">
      <Tabs defaultValue="details" value={step} onValueChange={(value) => setStep(value as Step)}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="shipping">Shipping</TabsTrigger>
          <TabsTrigger value="confirm">Confirm</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <p>Guide: Basketball Conditioning — digital PDF, delivered by email.</p>
        </TabsContent>
        <TabsContent value="shipping">
          <p>Nothing to ship — digital guides land in your inbox within a minute.</p>
        </TabsContent>
        <TabsContent value="confirm">
          <p>Review your order, then check out below.</p>
        </TabsContent>
      </Tabs>
      <div className="demo-row">
        <Button
          variant="secondary"
          disabled={index === 0}
          onClick={() => setStep(STEPS[index - 1])}
        >
          Back
        </Button>
        <Button
          variant="primary"
          disabled={index === STEPS.length - 1}
          onClick={() => setStep(STEPS[index + 1])}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
