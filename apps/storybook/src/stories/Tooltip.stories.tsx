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
