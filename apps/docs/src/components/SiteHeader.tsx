import Link from 'next/link';

import { allPages } from '../lib/site-map';
import { SiteSearch } from './SiteSearch';

const NAV = [
  { label: 'Foundations', href: '/foundations/color' },
  { label: 'Components', href: '/components' },
  { label: 'Patterns', href: '/patterns/header' },
  { label: 'Guidelines', href: '/guidelines/voice' },
  { label: 'Build with AI', href: '/build-with-ai' },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-wordmark" aria-label="Miltinson Design System home">
          <span>
            Miltinson<span className="site-wordmark__dot">.</span>
          </span>
          <span className="site-wordmark__suffix">Design system</span>
        </Link>
        <nav aria-label="Primary" className="site-header__nav">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="site-header__link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="site-header__actions">
          <SiteSearch pages={allPages()} />
          <a
            className="site-header__link"
            href="https://github.com/EliRobinson/design-system"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
