import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* One stylesheet chain, loaded once. elements.css carries tokens.css (through
   @elirobinson/react/styles.css, which opens with it) and the component styles
   in the order the cascade needs; site.css, the docs chrome, comes last. Do not
   import tokens.css or react/styles.css here as well: every import is a full
   second copy in the bundle, and the later copy silently wins every
   equal-specificity tie against site.css. stylesheet-graph.test.ts fails if
   tokens.css is reached more than once. */
import './elements.css';
import './site.css';

import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { THEME_BOOTSTRAP } from '../lib/theme';

export const metadata: Metadata = {
  title: {
    default: 'Miltinson Design System',
    template: '%s — Miltinson Design System',
  },
  description:
    'Tokens, React components, and AI patterns for building Miltinson-branded products — practical, honest, accessible by default.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    /* suppressHydrationWarning covers exactly one attribute: the bootstrap
       below sets data-theme on this element before React hydrates, so the DOM
       deliberately differs from the prerendered HTML. It does not extend to
       children. */
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
