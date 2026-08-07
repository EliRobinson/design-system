'use client';

import type { ColumnDef } from '@elirobinson/react/components/organisms/Table';
import { Table } from '@elirobinson/react/components/organisms/Table';

type Order = {
  id: string;
  customer: string;
  guide: string;
  amount: string;
  purchasedOn: string;
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
    purchasedOn: `2026-0${(index % 6) + 1}-${String((index % 28) + 1).padStart(2, '0')}`,
  }));
}

const columns: ColumnDef<Order>[] = [
  { accessorKey: 'id', header: 'Invoice' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'guide', header: 'Guide' },
  { accessorKey: 'amount', header: 'Amount' },
  { accessorKey: 'purchasedOn', header: 'Purchased' },
];

const orders = makeOrders(24);

export default function Filterable() {
  return (
    <Table
      data={orders}
      columns={columns}
      pageSize={6}
      filterable
      filterPlaceholder="Filter orders"
    />
  );
}
