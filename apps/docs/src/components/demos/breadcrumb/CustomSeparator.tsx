'use client';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@elirobinson/react/components/molecules/Breadcrumb';

export default function CustomSeparator() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>›</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink href="/guides">Coaching Guides</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>›</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink current>Practice Planning</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
