import { Geist, Geist_Mono } from 'next/font/google';

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
