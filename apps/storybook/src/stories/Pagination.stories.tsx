import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Pagination } from '@design-system/react/components/molecules/Pagination';

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  tags: ['autodocs'],
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

function PaginationDemo() {
  const [page, setPage] = useState(1);
  return <Pagination page={page} pageCount={5} onPageChange={setPage} />;
}

export const Default: Story = {
  args: { page: 1, pageCount: 5, onPageChange: () => {} },
  render: () => <PaginationDemo />,
};

function ManyPagesDemo() {
  const [page, setPage] = useState(10);
  return <Pagination page={page} pageCount={20} onPageChange={setPage} />;
}

/** Past seven pages the row keeps the first, the last and the current page
 *  with its neighbours, and draws a gap for the rest. */
export const ManyPages: Story = {
  args: { page: 10, pageCount: 20, onPageChange: () => {} },
  render: () => <ManyPagesDemo />,
};

/** When the row does not fit, it shows Previous, "Page X of Y" and Next. */
export const Narrow: Story = {
  args: { page: 3, pageCount: 6, onPageChange: () => {} },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
  render: function NarrowDemo() {
    const [page, setPage] = useState(3);
    return <Pagination page={page} pageCount={6} onPageChange={setPage} />;
  },
};
