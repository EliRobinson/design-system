'use client';

import { useState } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@elirobinson/react/components/organisms/Accordion';

export default function Controlled() {
  const [open, setOpen] = useState('shipping');

  return (
    <div className="demo-col">
      <p>
        Open section: <strong>{open || 'none'}</strong>
      </p>
      <Accordion type="single" value={open} onValueChange={setOpen}>
        <AccordionItem value="shipping">
          <AccordionTrigger>Shipping</AccordionTrigger>
          <AccordionContent>
            Coaching guide orders ship as an instant download — nothing physical to wait on.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="refunds">
          <AccordionTrigger>Refunds</AccordionTrigger>
          <AccordionContent>
            Full refund within 14 days if a guide isn&apos;t useful to you — just reply to the
            receipt email.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
