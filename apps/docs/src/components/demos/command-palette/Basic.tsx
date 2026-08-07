'use client';

import { useState } from 'react';

import { CommandPalette } from '@elirobinson/react/components/organisms/CommandPalette';

export default function Basic() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button type="button" className="ds-button ds-button--primary" onClick={() => setOpen(true)}>
        Open command palette
      </button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        commands={[
          {
            id: 'new-guide',
            label: 'New coaching guide',
            shortcut: ['⌘', 'N'],
            onSelect: () => {},
          },
          { id: 'search-apps', label: 'Search apps', shortcut: ['⌘', 'K'], onSelect: () => {} },
          { id: 'contact', label: 'Open contact form', onSelect: () => {} },
          { id: 'publish', label: 'Publish site', shortcut: ['⌘', 'S'], onSelect: () => {} },
        ]}
      />
    </div>
  );
}
