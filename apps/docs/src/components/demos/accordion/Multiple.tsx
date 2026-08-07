'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@elirobinson/react/components/organisms/Accordion';

export default function Multiple() {
  return (
    <Accordion type="multiple" defaultValue={['soccer']} className="demo-col">
      <AccordionItem value="soccer">
        <AccordionTrigger>Soccer — U8 season plan</AccordionTrigger>
        <AccordionContent>
          12 weeks of practice plans, scaled for a 45-minute session.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="basketball">
        <AccordionTrigger>Basketball — U10 season plan</AccordionTrigger>
        <AccordionContent>10 weeks, built around three drills per practice.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="track">
        <AccordionTrigger>Track — sprint fundamentals</AccordionTrigger>
        <AccordionContent>6 weeks of starts, form drills, and pacing work.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
