import { Component, type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { fixtures } from '../fixtures/index.js';
import './harness.css';

/* One fixture per page load, selected by query string, with the three dials
   from tokens.css set on <html> exactly as a consuming app sets them:
   ?fixture=message&theme=dark&palette=slate&platform=mobile

   One at a time rather than a gallery, because two of the four checks are about
   a control's *neighbours*: checkHitAreaOverlap walks a control's siblings, and
   checkTouchTargets probes outward from a control's centre until the browser
   stops routing hits back to it. Both would answer differently if an unrelated
   fixture were sitting next to the one under test, and the answer would be
   about the harness's layout rather than about the component. */

const params = new URLSearchParams(window.location.search);
const name = params.get('fixture') ?? '';
const root = document.documentElement;

root.dataset.theme = params.get('theme') ?? 'light';
if (params.get('palette')) root.dataset.palette = params.get('palette') as string;
if (params.get('platform')) root.dataset.platform = params.get('platform') as string;

/* A fixture that throws must say so out loud. Reporting "0 violations" for a
   component that never rendered is the same false green the four checks
   themselves go to such lengths to avoid, so the spec asserts on this
   attribute before it asserts on anything else. */
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      document.body.dataset.fixtureError = String(this.state.error.message ?? this.state.error);
      return <pre>{String(this.state.error.stack ?? this.state.error)}</pre>;
    }
    return this.props.children;
  }
}

const Fixture = fixtures[name];
const container = document.getElementById('root');

if (!container) throw new Error('harness: #root is missing from index.html');

if (!Fixture) {
  document.body.dataset.fixtureError = `no fixture named "${name}" — known: ${Object.keys(fixtures).join(', ')}`;
} else {
  createRoot(container).render(
    <StrictMode>
      <Boundary>
        <div data-fixture={name} id="fixture-root">
          <Fixture />
        </div>
      </Boundary>
    </StrictMode>,
  );
  /* The spec waits on this, not on a timeout: a fixture whose controls are
     mounted by an effect (Radix triggers, the carousel) is not measurable at
     first paint. */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.dataset.fixtureReady = 'true';
    });
  });
}
