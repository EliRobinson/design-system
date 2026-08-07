import type { Meta, StoryObj } from '@storybook/react-vite';
import { NavigationMenu } from '@design-system/react/components/organisms/NavigationMenu';

const meta = {
  title: 'Components/NavigationMenu',
  component: NavigationMenu,
  tags: ['autodocs'],
} satisfies Meta<typeof NavigationMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currentPath: '/settings/profile',
    items: [
      { label: 'Dashboard', href: '/' },
      {
        label: 'Settings',
        href: '/settings',
        items: [
          { label: 'Profile', href: '/settings/profile' },
          { label: 'Billing', href: '/settings/billing' },
        ],
      },
    ],
  },
};
