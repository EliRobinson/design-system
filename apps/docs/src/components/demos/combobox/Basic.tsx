'use client';

import { useState } from 'react';

import { Combobox } from '@elirobinson/react/components/organisms/Combobox';

const projects = [
  { label: 'Kids Recipes', value: 'kids-recipes' },
  { label: 'Interactive Maths', value: 'interactive-maths' },
  { label: 'Coaching Guides', value: 'coaching-guides' },
  { label: 'Miltinson marketing site', value: 'marketing-site' },
  { label: 'AI consulting intake', value: 'ai-consulting' },
  { label: 'Tech support queue', value: 'tech-support' },
];

export default function Basic() {
  const [value, setValue] = useState<string | undefined>();

  return (
    <Combobox
      label="Project"
      options={projects}
      value={value}
      onValueChange={setValue}
      className="demo-col"
    />
  );
}
