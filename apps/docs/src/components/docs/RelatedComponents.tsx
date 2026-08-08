import Link from 'next/link';

import { getComponent } from '../../lib/manifest';

export function RelatedComponents({ slugs }: { slugs: string[] }) {
  const related = slugs
    .map((slug) => getComponent(slug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  if (related.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Related components" className="related-components">
      {related.map((component) => (
        <Link key={component.slug} href={`/components/${component.slug}`} className="related-card">
          <span className="related-card__name">{component.name}</span>
          <span className="related-card__description">{component.description}</span>
        </Link>
      ))}
    </nav>
  );
}
