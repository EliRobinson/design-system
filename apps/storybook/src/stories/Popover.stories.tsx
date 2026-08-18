import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@design-system/react/components/organisms/Popover';

const meta = {
  title: 'Components/Popover',
  component: Popover,
  tags: ['autodocs'],
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: null },
  render: () => (
    <Popover>
      <PopoverTrigger>Filter guides</PopoverTrigger>
      <PopoverContent>
        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--fg-2)' }}>
          Practical, no-fluff guides written for sports coaches.
        </p>
      </PopoverContent>
    </Popover>
  ),
};

/* The closed trigger above is the only state a story exercised, and it shows
   none of what makes a popover worth testing — the panel is portalled into
   document.body, positioned against the trigger at runtime, and carries its own
   surface and elevation tokens. `defaultOpen` renders that without an
   interaction, so the visual suite captures it and a human can see it without
   clicking. */
export const Open: Story = {
  args: { children: null },
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger>Filter guides</PopoverTrigger>
      <PopoverContent>
        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--fg-2)' }}>
          Practical, no-fluff guides written for sports coaches.
        </p>
      </PopoverContent>
    </Popover>
  ),
};
