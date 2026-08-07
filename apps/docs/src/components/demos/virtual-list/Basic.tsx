'use client';

import { VirtualList } from '@elirobinson/react/components/organisms/VirtualList';

type Session = {
  id: number;
  customer: string;
  guide: string;
};

const CUSTOMERS = [
  'Jordan Ellis',
  'Priya Nair',
  'Sam Okafor',
  'Maria Gonzalez',
  'Tomás Rivera',
  'Aisha Bello',
  'Liam Chen',
  'Grace Kim',
  'Noah Fischer',
  'Ingrid Larsen',
];

const GUIDES = [
  'Youth Football Fundamentals',
  'Basketball Conditioning',
  'Rugby Contact Basics',
  'Athletics Sprint Mechanics',
  'Netball Footwork Drills',
  'Swim Stroke Technique',
];

const sessions: Session[] = Array.from({ length: 200 }, (_, index) => ({
  id: index + 1,
  customer: CUSTOMERS[index % CUSTOMERS.length],
  guide: GUIDES[index % GUIDES.length],
}));

export default function Basic() {
  return (
    <VirtualList
      items={sessions}
      estimateSize={() => 40}
      height={320}
      renderItem={(session) => (
        <span>
          <strong>#{session.id}</strong> {session.customer} — {session.guide}
        </span>
      )}
    />
  );
}
