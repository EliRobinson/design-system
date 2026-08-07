import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@elirobinson/tokens/tokens.css';
import '@elirobinson/react/styles.css';
import './site.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
