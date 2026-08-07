'use client';

import { NavigationMenu } from '@elirobinson/react/components/organisms/NavigationMenu';

export default function Basic() {
  return (
    <NavigationMenu
      className="demo-col"
      currentPath="/apps/kids-recipes"
      items={[
        { label: 'Home', href: '/' },
        {
          label: 'Apps',
          href: '/apps',
          items: [
            { label: 'Kids Recipes', href: '/apps/kids-recipes' },
            { label: 'Interactive Maths', href: '/apps/interactive-maths' },
          ],
        },
        { label: 'Coaching Guides', href: '/coaching-guides' },
        { label: 'About', href: '/about' },
      ]}
    />
  );
}
