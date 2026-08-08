'use client';

import { useRef } from 'react';
import { Button } from '@elirobinson/react/components/atoms/Button';
import { VirtualList } from '@elirobinson/react/components/organisms/VirtualList';
import type { VirtualListHandle } from '@elirobinson/react/components/organisms/VirtualList';

const items = Array.from({ length: 200 }, (_, index) => `Row ${index + 1}`);

export default function ScrollToIndex() {
  const listRef = useRef<VirtualListHandle>(null);

  return (
    <div className="demo-col">
      <div className="demo-row">
        <Button variant="secondary" onClick={() => listRef.current?.scrollToIndex(0)}>
          Jump to row 1
        </Button>
        <Button variant="secondary" onClick={() => listRef.current?.scrollToIndex(199)}>
          Jump to row 200
        </Button>
      </div>
      <VirtualList
        ref={listRef}
        items={items}
        estimateSize={() => 36}
        height={280}
        renderItem={(item) => <span>{item}</span>}
      />
    </div>
  );
}
