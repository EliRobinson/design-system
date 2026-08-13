import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BrandArtifactCard } from '@/components/brand/BrandArtifactCard';
import { getUiKit, kitSlug, uiKits } from '@/lib/brand';

/* One page per kit in the manifest — a new kit gets a page (and a sidebar
   entry, via site-map.ts) by appearing there, with no edit here. */
export function generateStaticParams() {
  return uiKits().map((kit) => ({ kit: kitSlug(kit) }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kit: string }>;
}): Promise<Metadata> {
  const { kit } = await params;
  return { title: getUiKit(kit)?.title ?? 'UI kit' };
}

export default async function UiKitPage({ params }: { params: Promise<{ kit: string }> }) {
  const { kit: slug } = await params;
  const kit = getUiKit(slug);
  if (!kit) {
    notFound();
  }

  return (
    <>
      <h1>{kit.title}</h1>
      <p className="lead">
        Rendered live from <code>{kit.path}</code> — the kit compiles its JSX in the browser, so the
        frame below is the same artifact a consumer opens from the packed brand skill.
      </p>
      {kit.components && kit.components.length > 0 && (
        <p>
          Defines:{' '}
          {kit.components.map((name, index) => (
            <span key={name}>
              {index > 0 && ', '}
              <code>{name}</code>
            </span>
          ))}
        </p>
      )}
      <BrandArtifactCard artifact={kit} />
    </>
  );
}
