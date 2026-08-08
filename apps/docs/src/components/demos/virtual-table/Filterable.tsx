'use client';

import type { ColumnDef } from '@elirobinson/react/components/organisms/VirtualTable';
import { VirtualTable } from '@elirobinson/react/components/organisms/VirtualTable';

type Order = {
  id: string;
  customer: string;
  guide: string;
  amount: string;
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

function makeOrders(count: number): Order[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `INV-${1000 + index}`,
    customer: CUSTOMERS[index % CUSTOMERS.length],
    guide: GUIDES[index % GUIDES.length],
    amount: `$${(18 + (index % 5) * 6).toFixed(2)}`,
  }));
}

const columns: ColumnDef<Order>[] = [
  { accessorKey: 'id', header: 'Invoice' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'guide', header: 'Guide' },
  { accessorKey: 'amount', header: 'Amount' },
];

const orders = makeOrders(200);

export default function Filterable() {
  return (
    <VirtualTable
      data={orders}
      columns={columns}
      height={360}
      rowHeight={44}
      filterable
      filterPlaceholder="Filter orders"
    />
  );
}
