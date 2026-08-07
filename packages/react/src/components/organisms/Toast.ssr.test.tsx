// @vitest-environment node
//
// Runs without jsdom on purpose. Portals are the one thing in this package
// that reach for `document` during render, so the only way to prove they are
// safe for a Next.js/Remix consumer is to render them where `document` does
// not exist at all.
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Toaster } from './Toast';

describe('Toast server rendering', () => {
  it('renders the Toaster provider without a document', () => {
    expect(typeof document).toBe('undefined');

    expect(() => renderToString(<Toaster>app content</Toaster>)).not.toThrow();
  });

  it('renders provider children into the server markup', () => {
    const html = renderToString(
      <Toaster>
        <main>dashboard</main>
      </Toaster>,
    );

    expect(html).toContain('dashboard');
  });

  it('omits the toast viewport from server markup so hydration starts empty', () => {
    const html = renderToString(<Toaster>app content</Toaster>);

    expect(html).not.toContain('ds-toast-viewport');
  });
});
