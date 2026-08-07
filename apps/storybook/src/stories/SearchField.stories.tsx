import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchField } from '@design-system/react/components/molecules/SearchField';

const meta = {
  title: 'Components/SearchField',
  component: SearchField,
  tags: ['autodocs'],
} satisfies Meta<typeof SearchField>;

export default meta;
type Story = StoryObj<typeof meta>;

function SearchFieldDemo() {
  const [value, setValue] = useState('');
  return <SearchField aria-label="Search" value={value} onValueChange={setValue} />;
}

export const Default: Story = {
  args: { 'aria-label': 'Search' },
  render: () => <SearchFieldDemo />,
};
