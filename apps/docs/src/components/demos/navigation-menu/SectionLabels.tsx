'use client';

import { NavigationMenu } from '@elirobinson/react/components/organisms/NavigationMenu';

export default function SectionLabels() {
  return (
    <NavigationMenu
      className="demo-col"
      currentPath="/foundations/color"
      items={[
        {
          label: 'Foundations',
          items: [
            { label: 'Color', href: '/foundations/color' },
            { label: 'Typography', href: '/foundations/typography' },
          ],
        },
        {
          label: 'Atoms',
          items: [
            { label: 'Avatar', href: '/components/avatar' },
            { label: 'Button', href: '/components/button' },
          ],
        },
      ]}
    />
  );
}
