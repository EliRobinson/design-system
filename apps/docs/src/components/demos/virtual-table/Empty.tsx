'use client';

import type { ColumnDef } from '@elirobinson/react/components/organisms/VirtualTable';
import { VirtualTable } from '@elirobinson/react/components/organisms/VirtualTable';

type Order = {
  id: string;
  customer: string;
  guide: string;
  amount: string;
};

const columns: ColumnDef<Order>[] = [
  { accessorKey: 'id', header: 'Invoice' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'guide', header: 'Guide' },
  { accessorKey: 'amount', header: 'Amount' },
];

export default function Empty() {
  return <VirtualTable data={[]} columns={columns} emptyMessage="No orders yet" />;
}
