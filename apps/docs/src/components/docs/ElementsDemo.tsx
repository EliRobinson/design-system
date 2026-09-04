'use client';

import { MotionConfig } from 'motion/react';

import { fixtures, variants } from '@elirobinson/ai-elements/fixtures';

/* The same freeze the /fixtures routes use, by import rather than by copy.
   `animation: none` on `.fixture-stage` handles the CSS transitions Radix
   ships; `MotionConfig` below handles Shimmer, which animates through Framer
   Motion's Web Animations path where the CSS rule has no effect. Both are
   needed, and defining either one twice is how they drift apart. */
import '@/app/fixtures/ai-elements/fixtures.css';

/* A vendored component, mounted from the same fixture the accessibility audit
   measures. Not a hand-written demo: two mounts of one component is two things
   to keep in step, and the audit's is the one that was actually verified.

   Fed a canned composition, never a live model. A live model is not
   deterministic and the visual suite cannot photograph it.

   A Client Component, because `MotionConfig` is one and because several
   fixtures build function-valued props — the same boundary reasoning as
   `app/fixtures/ai-elements/[component]/FixtureStage.tsx`. */
export function ElementsDemo({ component, variant }: { component: string; variant?: string }) {
  const Fixture = variant ? variants[component]?.[variant] : fixtures[component];

  /* A throw rather than a fallback: these pages are built at build time, so a
     fixture that has been renamed fails the build instead of shipping a blank
     box that nobody notices until a reader finds it. */
  if (!Fixture) {
    throw new Error(
      `ElementsDemo: no ${variant ? `variant "${variant}" of ` : ''}fixture "${component}". ` +
        'Fixtures live in packages/ai-elements/fixtures.',
    );
  }

  return (
    <figure className="demo-block">
      <div className="demo-block__stage demo-block__stage--elements fixture-stage">
        <MotionConfig reducedMotion="always">
          <Fixture />
        </MotionConfig>
      </div>
      {variant ? <figcaption className="demo-block__caption">{variant}</figcaption> : null}
    </figure>
  );
}
