'use client';

import { MotionConfig } from 'motion/react';

import { fixtures } from '@elirobinson/ai-elements/fixtures';

/* The part of the fixture page that actually mounts a component, kept out of
 * page.tsx and marked 'use client' for one reason: several fixtures (canvas,
 * connection, transcription — anything that reaches React Flow) build a
 * function-valued prop, such as a `connectionLineComponent`, and hand it
 * straight to a client-only component. page.tsx is an async Server Component,
 * so if it rendered `<Fixture />` itself, that function would have to cross
 * the server/client boundary as a prop — which Next.js rejects at build time
 * ("Functions cannot be passed directly to Client Components"). Once the
 * fixture is rendered from inside a Client Component instead, the function is
 * created and consumed on the same side of that boundary, exactly like the
 * hand-authored demo files under src/components/demos already do. */
export function FixtureStage({ component }: { component: string }) {
  const Fixture = fixtures[component];

  /* A component in the manifest with no fixture is a hole in the audit as well
     as in this page, so it is loud rather than blank. The a11y harness reports
     the same condition as a fixture error and its spec asserts on that first. */
  if (!Fixture) {
    return <p data-fixture-error={component}>No fixture named &quot;{component}&quot;.</p>;
  }

  return (
    <MotionConfig reducedMotion="always">
      <Fixture />
    </MotionConfig>
  );
}
