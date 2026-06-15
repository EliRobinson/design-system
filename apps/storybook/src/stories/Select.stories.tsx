import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from '@design-system/react/components/Select';

const meta = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  args: {
    label: 'Sport',
    children: (
      <>
        <option value="">Choose a sport</option>
        <option value="football">Football</option>
        <option value="basketball">Basketball</option>
        <option value="rugby">Rugby</option>
      </>
    ),
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: 'Filter guides by sport.' },
};

export const WithError: Story = {
  args: { error: 'Please select a sport.' },
};
