import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@elirobinson/react/styles.css';
import './globals.css';

import { DIAL_BOOTSTRAP } from '../lib/dials';

export const metadata: Metadata = {
  title: 'EliRobinson Design System App',
  description: 'Next.js starter powered by @elirobinson design-system packages.',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    /* suppressHydrationWarning covers exactly the attributes the bootstrap
       writes on this element — data-palette and data-theme — which it sets
       before React hydrates, so the DOM deliberately differs from the HTML the
       server rendered. It does not extend to children: React still reports a
       mismatch anywhere below here, which is where a real hydration bug would
       be. */
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* This is a server component, so the roster is read at module scope
            and baked into the script below at build time. Bumping
            @elirobinson/tokens regenerates it; there is nothing here to edit
            when a palette is added. See lib/dials.ts for why data-platform is
            not among the attributes it writes. */}
        <script dangerouslySetInnerHTML={{ __html: DIAL_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
