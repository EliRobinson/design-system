'use client';

import { useEffect, useState } from 'react';

import { CommandPalette } from '@elirobinson/react/components/organisms/CommandPalette';

export default function KeyboardShortcut() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div>
      <p>
        Press <kbd>⌘K</kbd> (or <kbd>Ctrl</kbd>+<kbd>K</kbd>) anywhere in this demo to open it.
      </p>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        commands={[
          { id: 'new-recipe', label: 'New recipe', onSelect: () => {} },
          { id: 'new-lesson', label: 'New maths lesson', onSelect: () => {} },
          { id: 'invite-coach', label: 'Invite a coach', onSelect: () => {} },
        ]}
      />
    </div>
  );
}
