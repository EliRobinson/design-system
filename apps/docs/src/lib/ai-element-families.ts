/* The vendored components that are worth documenting together, and the card
 * each grouping comes from.
 *
 * A written-down list of component names, which the root rule normally forbids
 * — so it takes the same shape as the `NAMEABLE` table in ai-elements.test.ts,
 * for the same reason. Each entry carries the card that decided it, the test
 * beside it fails when a name stops existing, and a demo page may name only the
 * subpaths of its own family. What the rule actually forbids is a roster typed
 * into prose that quietly goes wrong on the next re-sync; this is neither prose
 * nor a roster.
 *
 * It is explicitly a subset. Seven pages cover 22 of the 48 vendored
 * components, and /components/ai-elements — generated from the manifest — stays
 * the only complete list. A component that is in no family is documented there
 * and nowhere else, which is the intended outcome, not a gap.
 */

export type Family = {
  /** The route segment under /components/ai-elements. */
  slug: string;
  /** The page title, and the sidebar entry. */
  title: string;
  /** The Trello card this grouping is from, so the reasoning is findable. */
  card: string;
  /** Manifest names, not subpaths. Asserted against the manifest. */
  components: readonly string[];
};

export const FAMILIES: readonly Family[] = [
  {
    slug: 'conversation',
    title: 'Conversation and messages',
    card: 'C1',
    components: ['conversation', 'message'],
  },
  {
    slug: 'prompt-input',
    title: 'Prompt input',
    card: 'C2',
    components: ['prompt-input', 'attachments', 'model-selector'],
  },
  {
    slug: 'reasoning',
    title: 'Reasoning',
    card: 'C3',
    components: ['reasoning', 'chain-of-thought', 'shimmer'],
  },
  {
    slug: 'tools',
    title: 'Tools and tasks',
    card: 'C4',
    components: ['tool', 'confirmation', 'task'],
  },
  {
    slug: 'sources',
    title: 'Sources and context',
    card: 'C5',
    components: ['sources', 'inline-citation', 'context'],
  },
  {
    slug: 'planning',
    title: 'Suggestions and plans',
    card: 'C6',
    components: ['suggestion', 'plan', 'queue', 'checkpoint'],
  },
  {
    slug: 'artifacts',
    title: 'Code and artifacts',
    card: 'C7',
    components: ['code-block', 'artifact', 'image', 'snippet'],
  },
] as const;

/** The subpaths a family's page is permitted to name. */
export function familySubpaths(family: Family, packageName: string): string[] {
  return family.components.map((name) => `${packageName}/components/${name}`);
}
