'use client';

import { useState } from 'react';

import { Pagination } from '@elirobinson/react/components/molecules/Pagination';

export default function Basic() {
  const [page, setPage] = useState(1);

  return <Pagination page={page} pageCount={6} onPageChange={setPage} />;
}
