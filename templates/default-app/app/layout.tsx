import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@elirobinson/react/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'EliRobinson Design System App',
  description: 'Next.js starter powered by @elirobinson design-system packages.',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
