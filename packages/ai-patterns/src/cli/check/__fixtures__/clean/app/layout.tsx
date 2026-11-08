import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
