'use client';

import type { ColumnDef } from '@elirobinson/react/components/organisms/Table';
import { Table } from '@elirobinson/react/components/organisms/Table';

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
  return <Table data={[]} columns={columns} emptyMessage="No orders yet" />;
}
