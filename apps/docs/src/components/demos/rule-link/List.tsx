'use client';

import { RuleLink } from '@elirobinson/react/components/molecules/RuleLink';

export default function List() {
  return (
    <div className="demo-col">
      <RuleLink href="/services">See what I build</RuleLink>
      <RuleLink href="/store">Browse the store</RuleLink>
      <RuleLink href="/contact">Get in touch</RuleLink>
    </div>
  );
}
