'use client';

import { NavigationMenu } from '@elirobinson/react/components/organisms/NavigationMenu';

export default function NoCurrentPath() {
  return (
    <NavigationMenu
      className="demo-col"
      items={[
        { label: 'AI consulting', href: '/ai-consulting' },
        { label: 'Tech support', href: '/tech-support' },
        { label: 'Contact', href: '/contact' },
      ]}
    />
  );
}
