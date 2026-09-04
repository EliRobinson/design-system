import type { Metadata } from 'next';
import Link from 'next/link';

import { ELEMENTS_TIERS, elements, elementsByTier } from '../../../lib/ai-elements';
import { ELEMENTS_TIER_INTRO, TIER_INTRO } from '../../../lib/editorial';
import { TIERS, components, componentsByTier, hooks } from '../../../lib/manifest';

export const metadata: Metadata = { title: 'Components' };

export default function ComponentsIndexPage() {
  return (
    <>
      <h1>Components</h1>
      <p className="lead">
        The {components.length} components in <code>@elirobinson/react</code>, grouped by atomic
        tier. Every page carries live demos, a generated props table, the exact import subpath, and
        the keyboard contract you inherit. Which tier a component lands in is decided by the{' '}
        <Link href="/guidelines/tiers">tier boundary</Link>, four questions asked in order.
      </p>
      <p>
        Below them is a second set, counted separately because it is a second package:{' '}
        <Link href="/components/ai-elements">AI Elements</Link>, vendored from Vercel. One{' '}
        <code>pnpm add</code> gets you the tiers above; the AI tier is its own install, with its own
        requirement.
      </p>
      {TIERS.map((tier) => {
        const tierComponents = componentsByTier(tier);
        return (
          <section key={tier}>
            <h2>
              {tier} ({tierComponents.length})
            </h2>
            <p>{TIER_INTRO[tier]}</p>
            <div className="component-index__grid">
              {tierComponents.map((component) => (
                <Link
                  key={component.slug}
                  href={`/components/${component.slug}`}
                  className="related-card"
                >
                  <span className="related-card__name">{component.name}</span>
                  <span className="related-card__description">{component.description}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {/* The vendored tier, as its own group rather than as a footnote. The
          cards are the manifest's namespaces, so the counts and the grouping
          move with an upstream re-sync; what is hand-written is the
          requirement, and it is here because this is the page somebody browses
          before they import anything. A reader who takes a subpath from the
          index without reading its installation page has a build that renders
          unstyled HTML and no error to explain it. */}
      <section>
        {/* Named, not bare. Every other heading on this page counts
            components in one tier; this number is every vendored FILE across
            all three of the package's namespaces (components, ui, lib), which
            is a different unit sitting in a row of numbers that look alike.
            The prose below is careful about it and the heading was not. */}
        <h2>AI Elements ({elements.length} vendored modules)</h2>
        <p>
          The assistant tier — vendored from{' '}
          <a href="https://github.com/vercel/ai-elements">vercel/ai-elements</a> at a pinned release
          and skinned with this system&apos;s tokens. It ships as{' '}
          <code>@elirobinson/ai-elements</code>, a separate install from{' '}
          <code>@elirobinson/react</code>, and it is the one part of the system whose source is not
          ours.
        </p>
        <p className="index-group__requirement">
          <strong>These need a Tailwind 4 build.</strong> Nothing in the tiers above does — that
          difference is why they are separate packages, and without a Tailwind 4 pipeline a vendored
          component renders as unstyled HTML with no error to explain it. See{' '}
          <Link href="/components/ai-elements/installation">Installing AI Elements</Link>.
        </p>
        <div className="component-index__grid">
          {ELEMENTS_TIERS.map((tier) => (
            <Link key={tier} href={`/components/ai-elements#${tier}`} className="related-card">
              <span className="related-card__name">
                {tier} ({elementsByTier(tier).length})
              </span>
              <span className="related-card__description">{ELEMENTS_TIER_INTRO[tier]}</span>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2>Interaction hooks ({hooks.length})</h2>
        <p>
          The keyboard behaviors the organisms share, exported for when you build your own composite
          widgets — see <Link href="/components/hooks">interaction hooks</Link>.
        </p>
      </section>
    </>
  );
}
