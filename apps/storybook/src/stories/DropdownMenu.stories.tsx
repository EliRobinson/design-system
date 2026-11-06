import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@design-system/react/components/organisms/DropdownMenu';

const meta = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: null },
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger>Options</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const WithButtonTrigger: Story = {
  args: { children: null },
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger className="ds-button ds-button--secondary">Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuItem>Archive</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

function CheckableDemo() {
  const [statusBar, setStatusBar] = useState(true);
  const [minimap, setMinimap] = useState(false);
  const [sort, setSort] = useState('date');

  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger className="ds-button ds-button--secondary">View</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Show</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={statusBar} onCheckedChange={setStatusBar}>
          Status bar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={minimap} onCheckedChange={setMinimap}>
          Minimap
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel id="sort-label">Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup aria-labelledby="sort-label" value={sort} onValueChange={setSort}>
          <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="date">Date modified</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="size">Size</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Open by default so the visual suite captures the panel: a checked and an
   unchecked item of each kind, with the leading slot reserved in both, so the
   labels line up whether or not they carry a mark. */
export const Checkable: Story = {
  args: { children: null },
  render: () => <CheckableDemo />,
};

/* Both kinds of disabled — the `disabled` attribute and `aria-disabled` — next
   to a live item, so the disabled colour reads against the ordinary one. */
export const DisabledItems: Story = {
  args: { children: null },
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger className="ds-button ds-button--secondary">Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuItem disabled>Rename</DropdownMenuItem>
        <DropdownMenuItem aria-disabled="true">Move to…</DropdownMenuItem>
        <DropdownMenuCheckboxItem checked disabled>
          Pinned
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
