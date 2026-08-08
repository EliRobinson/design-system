import type { ReactNode } from 'react';

import { SiteSidebar } from '../../components/SiteSidebar';
import { siteSections } from '../../lib/site-map';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="docs-shell">
      <SiteSidebar sections={siteSections()} />
      <main className="docs-main">
        <article className="prose">{children}</article>
      </main>
    </div>
  );
}
