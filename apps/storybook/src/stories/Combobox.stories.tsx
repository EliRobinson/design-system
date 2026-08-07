import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Combobox } from '@design-system/react/components/organisms/Combobox';

const fruitOptions = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
  { label: 'Date', value: 'date' },
  { label: 'Elderberry', value: 'elderberry' },
  { label: 'Fig', value: 'fig' },
  { label: 'Grape', value: 'grape' },
];

const meta = {
  title: 'Components/Combobox',
  component: Combobox,
  tags: ['autodocs'],
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

function ComboboxDemo() {
  const [value, setValue] = useState<string | undefined>();
  return <Combobox label="Fruit" options={fruitOptions} value={value} onValueChange={setValue} />;
}

export const Default: Story = {
  args: { label: 'Fruit', options: fruitOptions, onValueChange: () => {} },
  render: () => <ComboboxDemo />,
};

function ComboboxLongListDemo() {
  const [value, setValue] = useState<string | undefined>();
  const manyOptions = Array.from({ length: 500 }, (_, index) => ({
    label: `Option ${index}`,
    value: `option-${index}`,
  }));
  return <Combobox label="Options" options={manyOptions} value={value} onValueChange={setValue} />;
}

export const LongList: Story = {
  args: { label: 'Options', options: [], onValueChange: () => {} },
  render: () => <ComboboxLongListDemo />,
};
