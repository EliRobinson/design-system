// @vitest-environment node
//
// See Toast.ssr.test.tsx — runs without jsdom so `document` genuinely does not
// exist, which is the only way to prove the portal is safe for a server render.
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Popover, PopoverContent, PopoverTrigger } from './Popover.js';

function openPopover() {
  return (
    <Popover open>
      <PopoverTrigger>Open</PopoverTrigger>
      <PopoverContent>panel body</PopoverContent>
    </Popover>
  );
}

describe('Popover server rendering', () => {
  it('renders a closed popover without a document', () => {
    expect(typeof document).toBe('undefined');

    expect(() =>
      renderToString(
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>panel body</PopoverContent>
        </Popover>,
      ),
    ).not.toThrow();
  });

  it('renders a popover that is already open without a document', () => {
    expect(() => renderToString(openPopover())).not.toThrow();
  });

  it('omits open popover content from server markup so hydration starts closed', () => {
    const html = renderToString(openPopover());

    expect(html).toContain('Open');
    expect(html).not.toContain('panel body');
  });

  // `defaultOpen` seeds the same open state as the `open` prop, so it reaches
  // the portal on the server too and has to be covered by the same mount gate.
  it('renders a popover opened via defaultOpen without a document', () => {
    expect(() =>
      renderToString(
        <Popover defaultOpen>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>panel body</PopoverContent>
        </Popover>,
      ),
    ).not.toThrow();
  });
});
