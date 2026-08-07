import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CommandPalette } from '@design-system/react/components/organisms/CommandPalette';

const meta = {
  title: 'Components/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

// No hooks in `render:` (B4) -- `useState` there is a react-hooks/rules-of-hooks
// lint error. Extracted into a named component instead, per Dialog.stories.tsx.
function CommandPaletteDemo() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button
        type="button"
        className="ds-button ds-button--primary"
        onClick={() => setIsOpen(true)}
      >
        Open command palette
      </button>
      <CommandPalette
        open={isOpen}
        onOpenChange={setIsOpen}
        commands={[
          { id: 'new', label: 'New file', shortcut: ['⌘', 'N'], onSelect: () => {} },
          { id: 'open', label: 'Open file', shortcut: ['⌘', 'O'], onSelect: () => {} },
          { id: 'save', label: 'Save', shortcut: ['⌘', 'S'], onSelect: () => {} },
        ]}
      />
    </div>
  );
}

export const Default: Story = {
  // Dummy args (B3) -- CommandPaletteProps has required props, so a story
  // supplying only `render` fails `pnpm typecheck` with "Property 'args' is
  // missing". These placeholders are never read; CommandPaletteDemo owns
  // the real state.
  args: { open: true, onOpenChange: () => {}, commands: [] },
  render: () => <CommandPaletteDemo />,
};
