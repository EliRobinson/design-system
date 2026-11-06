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

const noop = () => {};
const placeholder = { open: true, onOpenChange: noop, commands: [] };

export const GroupsAndDetail: Story = {
  args: placeholder,
  render: () => (
    <CommandPalette
      open
      onOpenChange={noop}
      commands={[
        { id: 'alma', label: 'Alma Reyes', group: 'Residents', detail: 'Ready', onSelect: noop },
        { id: 'ben', label: 'Ben Okafor', group: 'Residents', detail: 'Signed', onSelect: noop },
        {
          id: 'home',
          label: 'Home',
          group: 'Go to',
          detail: '/home',
          shortcut: ['G', 'H'],
          onSelect: noop,
        },
        { id: 'help', label: 'Help', group: 'Go to', detail: '/help', onSelect: noop },
      ]}
    />
  ),
};

export const Loading: Story = {
  args: placeholder,
  render: () => (
    <CommandPalette
      open
      onOpenChange={noop}
      query="al"
      onQueryChange={noop}
      filter={false}
      loading
      commands={[{ id: 'alma', label: 'Alma Reyes', group: 'Residents', onSelect: noop }]}
    />
  ),
};

export const ErrorState: Story = {
  args: placeholder,
  render: () => (
    <CommandPalette
      open
      onOpenChange={noop}
      query="al"
      onQueryChange={noop}
      filter={false}
      error="Search failed. Try again."
      commands={[]}
    />
  ),
};

export const TranslatedLabels: Story = {
  args: placeholder,
  render: () => (
    <CommandPalette
      open
      onOpenChange={noop}
      labels={{
        title: 'Paleta de comandos',
        search: 'Buscar comandos',
        list: 'Comandos',
        empty: 'Sin resultados',
      }}
      commands={[]}
    />
  ),
};
