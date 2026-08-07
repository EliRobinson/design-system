'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@elirobinson/react/components/organisms/Accordion';

export default function Basic() {
  return (
    <Accordion type="single" defaultValue="age" className="demo-col">
      <AccordionItem value="age">
        <AccordionTrigger>What age groups are the guides written for?</AccordionTrigger>
        <AccordionContent>
          Most guides cover ages 6–14, split by skill level rather than a strict age range — check
          the first page of each guide for the specific band.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="experience">
        <AccordionTrigger>Do I need coaching experience to use them?</AccordionTrigger>
        <AccordionContent>
          No. Every drill includes setup instructions and the common mistakes to watch for, written
          for a first-season volunteer coach.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="updates">
        <AccordionTrigger>How do I get updates after I buy?</AccordionTrigger>
        <AccordionContent>
          Guides are versioned PDFs — re-download from your order confirmation email any time I ship
          a revision.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
