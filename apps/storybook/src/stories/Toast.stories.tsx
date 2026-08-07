import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@design-system/react/components/atoms/Button';
import { Toaster, useToast } from '@design-system/react/components/organisms/Toast';

const meta = {
  title: 'Components/Toast',
  component: Toaster,
  tags: ['autodocs'],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

function ToastDemo() {
  const { toast } = useToast();

  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
      <Button
        variant="primary"
        onClick={() =>
          toast({
            title: 'Message sent',
            description: "I'll get back to you within 24 hours.",
          })
        }
      >
        Show toast
      </Button>
      <Button
        variant="accent"
        onClick={() =>
          toast({
            title: 'Guide downloaded',
            description: 'Check your downloads folder.',
            variant: 'success',
          })
        }
      >
        Success toast
      </Button>
    </div>
  );
}

export const Default: Story = {
  args: { children: null },
  render: () => (
    <Toaster>
      <ToastDemo />
    </Toaster>
  ),
};
