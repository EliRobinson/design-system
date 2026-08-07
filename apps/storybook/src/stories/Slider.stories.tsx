import type { Meta, StoryObj } from '@storybook/react-vite';
import { Slider } from '@design-system/react/components/atoms/Slider';

const meta = {
  title: 'Components/Slider',
  component: Slider,
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Volume', min: 0, max: 100, defaultValue: 50 },
};
