/* Extra mounts for the documentation, beyond the one realistic composition per
 * component that `./index.tsx` gives the accessibility audit.
 *
 * The audit wants exactly one mount per component: two of its four checks are
 * about a control's neighbours, so a gallery would measure the harness's layout
 * rather than the component. Documentation wants the opposite — a tool is worth
 * seeing pending, running, and errored, because those are the states a reader
 * is trying to decide between.
 *
 * Keyed by the component's name in the manifest, then by a label the demo page
 * renders verbatim. A component with nothing worth showing twice is absent.
 *
 * Guarded by apps/docs/src/lib/ai-element-fixtures.test.ts — that is where the
 * test for this module lives, not beside it, because this package has no
 * vitest config to run one.
 */
import type { ComponentType } from 'react';

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@elirobinson/ai-elements/components/tool';

export const variants: Record<string, Record<string, ComponentType>> = {
  tool: {
    'Input streaming': () => (
      <Tool defaultOpen>
        <ToolHeader state="input-streaming" type="tool-searchDocs" />
        <ToolContent>
          <ToolInput input={{ query: 'touch target' }} />
        </ToolContent>
      </Tool>
    ),
    'Output available': () => (
      <Tool defaultOpen>
        <ToolHeader state="output-available" type="tool-searchDocs" />
        <ToolContent>
          <ToolInput input={{ query: 'touch target' }} />
          <ToolOutput errorText={undefined} output={<p>3 matches in contracts.json.</p>} />
        </ToolContent>
      </Tool>
    ),
    'Output error': () => (
      <Tool defaultOpen>
        <ToolHeader state="output-error" type="tool-searchDocs" />
        <ToolContent>
          <ToolInput input={{ query: 'touch target' }} />
          <ToolOutput errorText="The index is not built." output={undefined} />
        </ToolContent>
      </Tool>
    ),
  },
};
