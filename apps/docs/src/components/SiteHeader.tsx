import Link from 'next/link';

import { allPages, firstPageOf } from '../lib/site-map';
import { SiteSearch } from './SiteSearch';
import { ThemeToggle } from './ThemeToggle';

/* Which sections get a top-level entry is editorial; where each one points
   derives from the section list, so the hrefs cannot drift from it. */
const NAV_SECTIONS = ['Foundations', 'Components', 'Patterns', 'Guidelines', 'Build with AI'];

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
          {NAV_SECTIONS.map((title) => (
            <Link key={title} href={firstPageOf(title).href} className="site-header__link">
              {title}
            </Link>
          ))}
        </nav>
        <div className="site-header__actions">
          <SiteSearch pages={allPages()} />
          <ThemeToggle />
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
