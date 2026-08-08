'use client';

import { useState } from 'react';

import { Badge } from '@elirobinson/react/components/atoms/Badge';
import { SegmentedControl } from '@elirobinson/react/components/molecules/SegmentedControl';

const options = [
  { label: 'List', value: 'list' },
  { label: 'Grid', value: 'grid' },
];

const GUIDES = ['U8 Practice Plans', 'U10 Practice Plans', 'Season Overview'];

export default function DrivingContent() {
  const [view, setView] = useState('list');

  return (
    <div className="demo-col">
      <SegmentedControl options={options} value={view} onValueChange={setView} />
      {view === 'list' ? (
        <ul>
          {GUIDES.map((guide) => (
            <li key={guide}>{guide}</li>
          ))}
        </ul>
      ) : (
        <div className="demo-row">
          {GUIDES.map((guide) => (
            <Badge key={guide} variant="outline">
              {guide}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
