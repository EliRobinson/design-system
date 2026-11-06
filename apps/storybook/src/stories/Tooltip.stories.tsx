import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@design-system/react/components/atoms/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@design-system/react/components/organisms/Tooltip';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: null },
  render: () => (
    <Tooltip>
      <TooltipTrigger>
        <Button variant="ghost">What's actually useful</Button>
      </TooltipTrigger>
      <TooltipContent>No hype — just practical AI help.</TooltipContent>
    </Tooltip>
  ),
};

/* A tooltip only exists while its trigger is hovered or focused, so each story
   below focuses its button after render. Focus, not hover, because it needs no
   pointer and holds the tooltip open for the screenshot. */
function openOnFocus({ canvasElement }: { canvasElement: HTMLElement }) {
  canvasElement.querySelector<HTMLElement>('.ds-tooltip__trigger button')?.focus();
}

export const SideRight: Story = {
  args: { children: null },
  parameters: { layout: 'centered' },
  play: openOnFocus,
  render: () => (
    <Tooltip side="right">
      <TooltipTrigger>
        <Button variant="ghost">Inbox</Button>
      </TooltipTrigger>
      <TooltipContent>Beside the trigger, so it never covers the next row.</TooltipContent>
    </Tooltip>
  ),
};

export const SideLeft: Story = {
  args: { children: null },
  parameters: { layout: 'padded' },
  play: openOnFocus,
  render: () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-8)' }}>
      <Tooltip side="left">
        <TooltipTrigger>
          <Button variant="ghost">Settings</Button>
        </TooltipTrigger>
        <TooltipContent>Hangs to the left.</TooltipContent>
      </Tooltip>
    </div>
  ),
};

export const SideTop: Story = {
  args: { children: null },
  parameters: { layout: 'centered' },
  play: openOnFocus,
  render: () => (
    <Tooltip side="top">
      <TooltipTrigger>
        <Button variant="ghost">Above</Button>
      </TooltipTrigger>
      <TooltipContent>Hangs above the trigger.</TooltipContent>
    </Tooltip>
  ),
};

/* The trigger sits on the right edge, so a right-hand tooltip has no room and
   flips to the left. */
export const FlipsAtTheEdge: Story = {
  args: { children: null },
  parameters: { layout: 'padded' },
  play: openOnFocus,
  render: () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-8)' }}>
      <Tooltip side="right">
        <TooltipTrigger>
          <Button variant="ghost">Near the edge</Button>
        </TooltipTrigger>
        <TooltipContent>Asked for the right, flipped to the left.</TooltipContent>
      </Tooltip>
    </div>
  ),
};

export const LabelOnly: Story = {
  args: { children: null },
  parameters: { layout: 'centered' },
  play: openOnFocus,
  render: () => (
    <Tooltip labelOnly side="right">
      <TooltipTrigger>
        <Button variant="ghost" aria-label="Search">
          🔍
        </Button>
      </TooltipTrigger>
      <TooltipContent>Search</TooltipContent>
    </Tooltip>
  ),
};
