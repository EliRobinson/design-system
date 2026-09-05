import manifest from '@elirobinson/ai-elements/manifest';

import '../fixtures.css';

import { FixtureStage } from './FixtureStage';

/* One vendored component per page, for the visual suite.
 *
 * Outside the (docs) route group on purpose. site-map.ts derives the sidebar
 * from the pages under (docs), so 48 fixture pages there would appear in the
 * nav, in the AI Elements section guard, and in every chrome shot — the exact
 * 142-shot fan-out that switched this project off in #101. Here they are a
 * test surface and nothing else.
 *
 * A bare <main>, because the docs sweep clips to `main` and `regionBox` throws
 * on a selector matching nothing rather than quietly framing the whole page.
 *
 * Motion is stopped three ways, because no one of them reaches all of it.
 * fixtures.css kills CSS animation and transition, and separately pins
 * Shimmer's `background-position`; MotionConfig covers the Framer Motion
 * transform and layout animations that CSS cannot see. `reducedMotion="always"`
 * rather than "user" — the freeze must not depend on a browser setting the
 * container might not carry. */

/* Only the `components` tier, matching what fixtures/index.tsx actually
 * mounts. manifest.entries also carries the `ui` (shadcn primitives) and
 * `lib` namespaces — 26 more entries with no fixture of their own, because
 * they are not what a consumer imports directly — and elements.a11y.spec.ts
 * applies the same filter for the same reason. Iterating the full manifest
 * here would still build (FixtureStage's "no fixture" branch is loud, not
 * broken), but it would silently double this route's count against every
 * number this task was scoped against. */
export function generateStaticParams() {
  return manifest.entries
    .filter((entry) => entry.tier === 'components')
    .map((entry) => ({ component: entry.name }));
}

export const dynamicParams = false;

export default async function FixturePage({ params }: { params: Promise<{ component: string }> }) {
  const { component } = await params;

  return (
    <main className="fixture-stage" data-fixture={component}>
      <FixtureStage component={component} />
    </main>
  );
}
