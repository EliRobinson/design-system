// @vitest-environment node
//
// See Toast.ssr.test.tsx — runs without jsdom so `document` genuinely does not
// exist, which is the only way to prove the portal is safe for a server render.
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip.js';

describe('Tooltip server rendering', () => {
  it('renders without a document', () => {
    expect(typeof document).toBe('undefined');

    expect(() =>
      renderToString(
        <Tooltip>
          <TooltipTrigger>Help</TooltipTrigger>
          <TooltipContent>explanatory text</TooltipContent>
        </Tooltip>,
      ),
    ).not.toThrow();
  });

  it('omits tooltip content from server markup', () => {
    const html = renderToString(
      <Tooltip>
        <TooltipTrigger>Help</TooltipTrigger>
        <TooltipContent>explanatory text</TooltipContent>
      </Tooltip>,
    );

    expect(html).toContain('Help');
    expect(html).not.toContain('explanatory text');
  });
});
