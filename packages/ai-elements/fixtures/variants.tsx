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
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextTrigger,
} from '@elirobinson/ai-elements/components/context';
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationText,
} from '@elirobinson/ai-elements/components/inline-citation';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@elirobinson/ai-elements/components/model-selector';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@elirobinson/ai-elements/components/tool';

/* The closed half of the three components whose open state is portalled.
 *
 * `./index.tsx` opens every collapsible, dialog and hover card it mounts,
 * because the audit cannot measure a control that is not in the DOM and each
 * fixture has a whole page to itself. A documentation page does not: a Radix
 * dialog or hover card renders into a portal on document.body, so an
 * open-by-default one escapes the demo's box and lands on top of the prose and
 * the sidebar — verified in a browser against the built site, where the open
 * model selector covered the page it was supposed to be illustrating.
 *
 * So the demo pages mount these closed and let the reader open them, which is
 * also the interaction worth showing. The default mount is unchanged and the
 * audit still measures the open state.
 */
export const variants: Record<string, Record<string, ComponentType>> = {
  context: {
    Closed: () => (
      <Context
        maxTokens={200_000}
        usage={{
          inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 900 },
          inputTokens: 900,
          outputTokenDetails: { reasoningTokens: 0, textTokens: 300 },
          outputTokens: 300,
          totalTokens: 1200,
        }}
        usedTokens={1200}
      >
        <ContextTrigger />
        <ContextContent>
          <ContextContentHeader />
          <ContextContentBody>
            <ContextInputUsage />
            <ContextOutputUsage />
          </ContextContentBody>
        </ContextContent>
      </Context>
    ),
  },

  'inline-citation': {
    Closed: () => (
      <p>
        <InlineCitation>
          <InlineCitationText>Target Size (Minimum) is 24 by 24.</InlineCitationText>
          <InlineCitationCard>
            <InlineCitationCardTrigger sources={['https://example.com/wcag']} />
            <InlineCitationCardBody>
              <InlineCitationCarousel>
                <InlineCitationCarouselHeader>
                  <InlineCitationCarouselPrev />
                  <InlineCitationCarouselNext />
                </InlineCitationCarouselHeader>
                <InlineCitationCarouselContent>
                  <InlineCitationCarouselItem>
                    <InlineCitationQuote>Targets are at least 24 by 24.</InlineCitationQuote>
                  </InlineCitationCarouselItem>
                </InlineCitationCarouselContent>
              </InlineCitationCarousel>
            </InlineCitationCardBody>
          </InlineCitationCard>
        </InlineCitation>
      </p>
    ),
  },

  'model-selector': {
    Closed: () => (
      <ModelSelector>
        <ModelSelectorTrigger>Claude Opus</ModelSelectorTrigger>
        <ModelSelectorContent>
          <ModelSelectorList>
            <ModelSelectorItem value="opus">
              <ModelSelectorName>Claude Opus</ModelSelectorName>
            </ModelSelectorItem>
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelector>
    ),
  },

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
