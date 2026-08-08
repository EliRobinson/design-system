'use client';

import { Kbd } from '@elirobinson/react/components/atoms/Kbd';

export default function Combo() {
  return (
    <div className="demo-row">
      <span>Open the command palette</span>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </div>
  );
}
