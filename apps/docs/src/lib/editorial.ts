/* Editorial prose keyed by manifest identifiers. The words stay hand-written
   — they are judgment, not derivation — but the key sets are contracts:
   editorial.test.ts asserts they exactly cover the manifest's hook and tier
   sets, so a rename or addition fails CI instead of silently dropping a
   usage note or rendering an empty paragraph. */

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

/* Which components consume each hook — usage prose, sourced from
   docs/agents/components.md and the component imports themselves. */
export const HOOK_USED_BY: Record<string, string> = {
  useActiveDescendant: 'Used by Combobox and CommandPalette.',
  useRovingFocus: 'Used by Tabs and SegmentedControl.',
  useClickOutside: 'Used by the anchored overlays — Popover, DropdownMenu, Combobox, DatePicker.',
  useEscapeKey: 'Used by the anchored overlays alongside useClickOutside.',
  useAnchoredPosition: 'Used by Popover, DropdownMenu, and Tooltip.',
  useDisclosure: 'Used by Dialog, Sheet, Popover, and DropdownMenu.',
  useHasMounted:
    'Used by Toaster, PopoverContent, DropdownMenuContent, and TooltipContent to skip their portals during server rendering.',
};
