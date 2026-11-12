import type { HookRecord } from './manifest';

/* Editorial prose keyed by manifest identifiers. The words stay hand-written
   — they are judgment, not derivation — but the key sets are contracts:
   editorial.test.ts asserts the tier maps exactly cover the manifest's tiers
   and the hook notes name only hooks it ships, so a rename or addition fails
   CI instead of silently dropping a note or rendering an empty paragraph. */

export const TIER_INTRO: Record<string, string> = {
  ai: 'Surfaces that only mean anything inside an assistant interaction — a turn-taking message log, a streaming affordance. This is the one tier decided by domain, and the tier boundary asks about it first.',
  atoms: 'Single-purpose primitives — not further divisible.',
  molecules:
    'A few atoms combined into one functional unit, with no portal or overlay orchestration.',
  organisms:
    'Compound components with internal state or overlay orchestration — portals, focus management, keyboard navigation.',
};

/* The same, for the namespaces @elirobinson/ai-elements vendors. A separate map
   rather than more keys in the one above: these are directories in somebody
   else's repository, not tiers of this system's atomic scale, and the tier
   boundary in docs/agents/components.md does not decide them. Rendered on both
   /components (as the group's cards) and the index page itself, so the two
   cannot describe the same namespace differently. */
export const ELEMENTS_TIER_INTRO: Record<string, string> = {
  components:
    'The assistant surfaces themselves — conversation and message logs, prompt inputs, tool and reasoning panels, artifact and canvas views.',
  ui: 'The shadcn/ui primitives those components are built on, vendored because they are what those components import.',
  lib: 'The helpers the tree shares.',
};

/* Why a hook's users use it — judgment the import graph cannot supply. Who
   uses it is not written here: the manifest derives each hook's `usedBy` from
   the imports in packages/react/src, and hookUsage() puts the two together. A
   hook with nothing to add has no entry. */
export const HOOK_NOTES: Record<string, string> = {
  useEscapeKey: 'They share one layer stack.',
  useHasMounted: 'Each one skips its portal during server rendering.',
};

const listFormat = new Intl.ListFormat('en', { type: 'conjunction' });

/** The hooks page's usage line: the derived users, then the editorial note. */
export function hookUsage(hook: Pick<HookRecord, 'name' | 'usedBy'>): string {
  const users = hook.usedBy.length > 0 ? `Used by ${listFormat.format(hook.usedBy)}.` : '';
  return [users, HOOK_NOTES[hook.name]].filter(Boolean).join(' ');
}
