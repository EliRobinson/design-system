'use client';

import { Pagination } from '@elirobinson/react/components/molecules/Pagination';

export default function Boundaries() {
  return (
    <div className="demo-col">
      <Pagination page={1} pageCount={4} onPageChange={() => {}} />
      <Pagination page={4} pageCount={4} onPageChange={() => {}} />
    </div>
  );
}
