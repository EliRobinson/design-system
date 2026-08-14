// @vitest-environment node
//
// See Toast.ssr.test.tsx — runs without jsdom so `document` genuinely does not
// exist, which is the only way to prove the portal is safe for a server render.
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './DropdownMenu.js';

function openMenu() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu server rendering', () => {
  it('renders a closed menu without a document', () => {
    expect(typeof document).toBe('undefined');

    expect(() =>
      renderToString(
        <DropdownMenu>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    ).not.toThrow();
  });

  it('renders a menu that is already open without a document', () => {
    expect(() => renderToString(openMenu())).not.toThrow();
  });

  it('omits open menu content from server markup so hydration starts closed', () => {
    const html = renderToString(openMenu());

    expect(html).toContain('Actions');
    expect(html).not.toContain('Duplicate');
  });

  // `defaultOpen` seeds the same open state as the `open` prop, so it reaches
  // the portal on the server too and has to be covered by the same mount gate.
  it('renders a menu opened via defaultOpen without a document', () => {
    expect(() =>
      renderToString(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    ).not.toThrow();
  });
});
