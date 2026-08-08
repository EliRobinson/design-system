'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@elirobinson/react/components/organisms/Accordion';

export default function HeadingLevel() {
  return (
    <Accordion type="single" headingLevel={2} defaultValue="scope" className="demo-col">
      <AccordionItem value="scope">
        <AccordionTrigger>What&apos;s included in AI consulting?</AccordionTrigger>
        <AccordionContent>
          An audit of your current stack, a short list of what&apos;s actually worth automating, and
          hands-on setup for the first one or two changes.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="pricing">
        <AccordionTrigger>How is it priced?</AccordionTrigger>
        <AccordionContent>From $150/hr, billed in 30-minute increments.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
