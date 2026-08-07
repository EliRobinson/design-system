import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Rating } from '@design-system/react/components/molecules/Rating';

const meta = {
  title: 'Components/Rating',
  component: Rating,
  tags: ['autodocs'],
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnly: Story = {
  args: { value: 4 },
};

function RatingDemo() {
  const [value, setValue] = useState(3);
  return <Rating value={value} onValueChange={setValue} />;
}

export const Interactive: Story = {
  args: { value: 3 },
  render: () => <RatingDemo />,
};
