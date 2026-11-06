import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from '@design-system/react/components/atoms/Checkbox';
import { FieldError } from '@design-system/react/components/atoms/FieldError';

const meta = {
  title: 'Components/FieldError',
  component: FieldError,
  tags: ['autodocs'],
  args: {
    children: 'Make at least 1 Manager an Admin.',
  },
} satisfies Meta<typeof FieldError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The error of a group with no control of its own, described by its id. */
export const OnAGroup: Story = {
  render: (args) => (
    <fieldset aria-describedby="managers-error" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="ds-label">Managers</legend>
      <Checkbox label="Ada (Admin)" />
      <Checkbox label="Grace (Admin)" />
      <FieldError {...args} id="managers-error" />
    </fieldset>
  ),
};
