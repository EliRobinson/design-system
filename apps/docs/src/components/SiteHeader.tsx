import Link from 'next/link';

import { allPages, siteSections } from '../lib/site-map';
import { GITHUB_LINK, SECTION_LINKS } from '../lib/site-links';
import { SiteMenu } from './SiteMenu';
import { SiteSearch } from './SiteSearch';
import { ThemeToggle } from './ThemeToggle';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <SiteMenu sections={siteSections()} links={[...SECTION_LINKS, GITHUB_LINK]} />
        <Link href="/" className="site-wordmark" aria-label="Miltinson Design System home">
          <span>
            Miltinson<span className="site-wordmark__dot">.</span>
          </span>
          <span className="site-wordmark__suffix">Design system</span>
        </Link>
        <nav aria-label="Primary" className="site-header__nav">
          {SECTION_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="site-header__link">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="site-header__actions">
          <SiteSearch pages={allPages()} />
          <ThemeToggle />
          <a className="site-header__link" href={GITHUB_LINK.href} rel="noreferrer">
            {GITHUB_LINK.label}
          </a>
        </div>
      </div>
    </header>
  );
}
