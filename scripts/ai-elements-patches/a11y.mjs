/**
 * The accessibility half of the AI Elements transform layer.
 *
 * Elements is well built. It was not built to this system's contracts, and this
 * file is the difference — measured, not assumed. Every entry below names a
 * control that `@elirobinson/ai-patterns/testing/playwright` reported failing,
 * in a browser, against the shipped tokens, and says which of the two touch
 * target floors that control belongs to and why. The harness that produced the
 * numbers is `packages/ai-elements/a11y`; re-run it with `pnpm a11y:elements`.
 *
 * ---------------------------------------------------------------------------
 * The two floors, and why the default is 44
 * ---------------------------------------------------------------------------
 * `contracts.json` holds primary controls to `var(--target)` (44x44, WCAG 2.2
 * AAA SC 2.5.5) and deliberately compact ones to `var(--target-min)` (24x24, AA
 * SC 2.5.8). The dense tier is a second floor, not an exemption: a control that
 * declares itself dense is still measured, just against the standard's own
 * number.
 *
 * So the shape here mirrors the shape tokens.css already uses for our own
 * components: one floor that applies by default, plus a written-down exclusion
 * list. `ui/button.tsx` carries
 * `not-data-[touch-target=dense]:min-h-[var(--target)]`, which floors every
 * button in the vendored tree that has not been classified dense — and each
 * control that HAS been is an entry below with a reason attached. That is what
 * makes this a per-control judgement rather than a blanket exemption: the
 * default is the strict floor, and every relaxation is named.
 *
 * The token, never the number. `min-h-[var(--target)]` is a Tailwind arbitrary
 * value wrapping a design system token, which is the form
 * `no-hardcoded-design-values` asks for: a literal `44px` here could not be
 * re-pointed by `[data-platform="mobile"]` and would silently stop tracking the
 * contract.
 *
 * ---------------------------------------------------------------------------
 * Why anchored string edits, and why that is safe
 * ---------------------------------------------------------------------------
 * The transform layer runs on upstream bytes, so a patch is a find/replace on
 * upstream source. That is brittle by construction — and the brittleness is the
 * feature. `assertPatch` below throws when an anchor does not appear exactly
 * the expected number of times, so the day upstream rewrites one of these class
 * strings, `pnpm sync:elements` fails loudly and names the control, rather than
 * dropping the fix and reporting a clean bump. A patch that silently stopped
 * applying is the failure mode this whole file exists to avoid; a build that
 * stops is the cheap one.
 *
 * ---------------------------------------------------------------------------
 * What is deliberately NOT here
 * ---------------------------------------------------------------------------
 * Colour. Two contrast findings and one Tailwind-variant finding came out of
 * the same sweep and belong to the token bridge, not here — see
 * `docs/agents/ai-elements-accessibility.md`. Nothing in this file changes a
 * colour value.
 */

/** A primary control's floor. Both axes, for a control that is its own box. */
const TARGET = 'min-h-[var(--target)] min-w-[var(--target)]';

/** Height only, for a control that already spans a row. */
const TARGET_H = 'min-h-[var(--target)]';

/**
 * The marker `DENSE_AFFORDANCE_SELECTOR` looks for. Written as a JSX attribute
 * so it lands on the element that receives the click — the mistake
 * `.ds-rating__star` made was putting the marker on an inner glyph, where the
 * exemption matched nothing and read as a clean sweep.
 */
const DENSE = 'data-touch-target="dense"';

/**
 * Every patch. `verdict` is the classification this control was given,
 * `why` is the reason it is not the other one, and `measured` is what the
 * browser reported before the patch.
 *
 * `count` defaults to 1 and is the number of times `find` must occur in that
 * file. Stating it is what turns "upstream moved this" into a loud failure
 * instead of a partial application.
 */
export const PATCHES = [
  // ---------------------------------------------------------------------
  // The default floor. One entry, because everything that is a button in this
  // tree goes through `ui/button.tsx` — InputGroupButton, which the prompt
  // composer's submit and tool row are built from, renders one too.
  // ---------------------------------------------------------------------
  {
    id: 'button-floor',
    upstreamPath: 'packages/shadcn-ui/components/ui/button.tsx',
    control: 'ui/button.tsx — every <Button> in the tree',
    verdict: 'primary',
    measured: 'default 36px, sm 32px, icon 36x36, icon-sm 32x32, icon-lg 40x40',
    why:
      'The floor every vendored button gets unless it is classified dense elsewhere in ' +
      'this list. ' +
      'shadcn sizes at 32-40px, which clears AA and misses this system’s AAA ' +
      'default; the `not-data-[touch-target=dense]` guard is what keeps that a ' +
      'default rather than a blanket, and it cannot be undone by a consumer’s ' +
      'className the way a merged utility could.',
    find: 'shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring',
    replace:
      'shrink-0 [&_svg]:shrink-0 not-data-[touch-target=dense]:min-h-[var(--target)] ' +
      'not-data-[touch-target=dense]:min-w-[var(--target)] outline-none focus-visible:border-ring',
  },
  {
    id: 'command-item-floor',
    upstreamPath: 'packages/shadcn-ui/components/ui/command.tsx',
    control: 'ui/command.tsx — CommandItem (model, voice and mic pickers)',
    verdict: 'primary',
    measured: '32px tall',
    why: 'Choosing a model or a microphone is the whole point of the surface it sits on.',
    find: 'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none',
    replace: `relative flex ${TARGET_H} cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none`,
  },
  {
    id: 'dropdown-item-floor',
    upstreamPath: 'packages/shadcn-ui/components/ui/dropdown-menu.tsx',
    control: 'ui/dropdown-menu.tsx — DropdownMenuItem (open-in-chat, prompt input action menu)',
    verdict: 'primary',
    measured: '32px tall',
    why: 'A menu row is a nav item, which contracts.json already names as primary.',
    find: 'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8',
    replace: `relative flex ${TARGET_H} cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8`,
  },
  {
    id: 'select-item-floor',
    upstreamPath: 'packages/shadcn-ui/components/ui/select.tsx',
    control: 'ui/select.tsx — SelectItem',
    verdict: 'primary',
    measured:
      '32px tall (PREDICTED — no fixture in the harness opens a Select menu; the markup is ' +
      'the same as CommandItem and DropdownMenuItem, both of which were measured)',
    why:
      'Same control, same reason. Left at a different height from the menu rows beside ' +
      'it, it would read as a bug.',
    find: 'relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm',
    replace: `relative flex w-full ${TARGET_H} cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm`,
  },
  {
    id: 'tabs-trigger-floor',
    upstreamPath: 'packages/shadcn-ui/components/ui/tabs.tsx',
    control: 'ui/tabs.tsx — TabsTrigger (sandbox)',
    verdict: 'primary',
    measured: '58x38 and 64x38',
    why: '[role="tab"] is in PRIMARY_CONTROL_SELECTOR by name, and a tab bar is navigation.',
    find: 'inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5',
    replace: `inline-flex h-[calc(100%-1px)] ${TARGET_H} flex-1 items-center justify-center gap-1.5`,
  },
  {
    id: 'accordion-trigger-floor',
    upstreamPath: 'packages/shadcn-ui/components/ui/accordion.tsx',
    control: 'ui/accordion.tsx — AccordionTrigger (agent tools)',
    verdict: 'primary',
    measured: '1212x36 — full width, 36 tall',
    why:
      'A disclosure row already spans its container, so height is the only axis in ' +
      'question and there is no density cost to answering it.',
    find: 'flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium',
    replace: `flex flex-1 ${TARGET_H} items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium`,
  },

  // ---------------------------------------------------------------------
  // Primary: a dismiss control has to be findable, and this one was 16x16 —
  // below even the dense floor, so there was no tier it could have been
  // classified into.
  // ---------------------------------------------------------------------
  {
    id: 'dialog-close-hit-area',
    upstreamPath: 'packages/shadcn-ui/components/ui/dialog.tsx',
    control: 'ui/dialog.tsx — the built-in close button (model selector, voice selector)',
    verdict: 'primary',
    measured: '16x16',
    why:
      'The painted glyph stays 16px and the hit area grows around it, which is what ' +
      'contracts.json asks for — the button has no fill at rest, so nothing visible ' +
      'changes. 16x16 misses 24x24 as well, so declaring it dense was never available.',
    find: 'absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100',
    replace: `absolute top-4 right-4 flex ${TARGET} items-center justify-center rounded-xs opacity-70 transition-opacity hover:opacity-100`,
  },

  // ---------------------------------------------------------------------
  // Primary: a form control. Painted at the shadcn scale, reached through a
  // bounded overlay rather than by inflating the track.
  // ---------------------------------------------------------------------
  {
    id: 'switch-hit-area',
    upstreamPath: 'packages/shadcn-ui/components/ui/switch.tsx',
    control: 'ui/switch.tsx — Switch (environment variables)',
    verdict: 'primary',
    measured: '32x18',
    why:
      'tokens.css floors our own switches to var(--target) on a phone, so a vendored ' +
      'one is not a different kind of control. A `::before` centred on the track ' +
      'gives the finger 44x44 while the switch stays 32x18 — the bounded overlay ' +
      'contracts.json prescribes. Verified against hit-area-no-overlap: the overlay ' +
      'reaches 22px from the track’s centre and no sibling’s centre is inside that.',
    find: 'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
    replace:
      'peer relative before:absolute before:top-1/2 before:left-1/2 ' +
      'before:size-[var(--target)] before:-translate-x-1/2 before:-translate-y-1/2 ' +
      "before:content-[''] data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
  },

  // ---------------------------------------------------------------------
  // Primary: disclosure rows Elements writes itself, rather than through a
  // shadcn primitive. All full-width, all measured between 16px and 36px tall.
  // ---------------------------------------------------------------------
  {
    id: 'sources-trigger-floor',
    upstreamPath: 'packages/elements/src/sources.tsx',
    control: 'sources.tsx — SourcesTrigger',
    verdict: 'primary',
    measured: '110x16',
    why: 'A 16px-tall disclosure row misses the dense floor too, so there is no second tier to fall back to.',
    find: 'className={cn("flex items-center gap-2", className)}',
    replace: `className={cn("flex ${TARGET_H} items-center gap-2", className)}`,
  },
  {
    id: 'source-link-floor',
    upstreamPath: 'packages/elements/src/sources.tsx',
    control: 'sources.tsx — Source (the citation link)',
    verdict: 'primary',
    measured: '152x16',
    why:
      'A citation marker: an a[href] that navigates away from the page, sitting in a ' +
      'list where every row is free to be taller.',
    find: 'className="flex items-center gap-2"\n    href={href}',
    replace: `className="flex ${TARGET_H} items-center gap-2"\n    href={href}`,
  },
  {
    id: 'reasoning-trigger-floor',
    upstreamPath: 'packages/elements/src/reasoning.tsx',
    control: 'reasoning.tsx — ReasoningTrigger',
    verdict: 'primary',
    measured: '1248x20',
    why: 'Same shape as SourcesTrigger: a full-width row at 20px.',
    find: '"flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"',
    replace: `"flex w-full ${TARGET_H} items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"`,
  },
  {
    id: 'chain-of-thought-header-floor',
    upstreamPath: 'packages/elements/src/chain-of-thought.tsx',
    control: 'chain-of-thought.tsx — ChainOfThoughtHeader',
    verdict: 'primary',
    measured: '1248x20',
    why: 'Same shape again.',
    find: '"flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",',
    replace: `"flex w-full ${TARGET_H} items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",`,
  },
  {
    id: 'queue-section-trigger-floor',
    upstreamPath: 'packages/elements/src/queue.tsx',
    control: 'queue.tsx — QueueSectionTrigger',
    verdict: 'primary',
    measured: '1222x36',
    why: 'A full-width section header that collapses its list.',
    find: '"group flex w-full items-center justify-between rounded-md bg-muted/40 px-3 py-2',
    replace: `"group flex w-full ${TARGET_H} items-center justify-between rounded-md bg-muted/40 px-3 py-2`,
  },
  {
    id: 'file-tree-row-floor',
    upstreamPath: 'packages/elements/src/file-tree.tsx',
    control: 'file-tree.tsx — the folder/file name row',
    verdict: 'primary',
    measured: '1194x20',
    why: 'The row is what a user aims at to open a folder; it spans the tree already.',
    find: 'className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left"',
    replace: `className="flex min-w-0 flex-1 ${TARGET_H} cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left"`,
  },
  {
    id: 'file-tree-chevron-hit-area',
    upstreamPath: 'packages/elements/src/file-tree.tsx',
    control: 'file-tree.tsx — the expand/collapse chevron beside the row',
    verdict: 'dense',
    measured: '16x16',
    why:
      'A second, redundant way to do what the row beside it already does, drawn at ' +
      'the size of its glyph. Dense — but 16x16 misses the dense floor as well, so ' +
      'it is grown to var(--target-min) rather than merely declared.',
    find: 'className="flex shrink-0 cursor-pointer items-center border-none bg-transparent p-0"',
    replace:
      'className="flex size-[var(--target-min)] shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0"\n                data-touch-target="dense"',
  },
  {
    id: 'inline-citation-carousel-paging-floor',
    upstreamPath: 'packages/elements/src/inline-citation.tsx',
    control: 'inline-citation.tsx — InlineCitationCarouselPrev and …Next',
    verdict: 'primary',
    measured: '16x16 each',
    why:
      'Carousel paging is pagination, which contracts.json names as primary in the ' +
      'same breath as buttons and nav items.',
    count: 2,
    find: 'className={cn("shrink-0", className)}',
    replace: `className={cn("flex ${TARGET} shrink-0 items-center justify-center", className)}`,
  },
  {
    id: 'canvas-controls-floor',
    upstreamPath: 'packages/elements/src/controls.tsx',
    control: 'controls.tsx — the React Flow zoom/fit/lock cluster',
    verdict: 'primary',
    measured: '26x26 each',
    why:
      'Viewport controls on a canvas are hit repeatedly and by feel. The buttons are ' +
      'React Flow’s, but Elements already restyles them through `[&>button]`, so the ' +
      'floor goes the same way.',
    find: '"[&>button]:rounded-md [&>button]:border-none! [&>button]:bg-transparent!',
    replace:
      '"[&>button]:min-h-[var(--target)] [&>button]:min-w-[var(--target)] ' +
      '[&>button]:rounded-md [&>button]:border-none! [&>button]:bg-transparent!',
  },
  {
    id: 'audio-player-control-bar-floor',
    upstreamPath: 'packages/elements/src/audio-player.tsx',
    control: 'audio-player.tsx — the mute button, time display and time range in the control bar',
    verdict: 'primary',
    measured: '49x32 (mute) and 63x32 (time display)',
    why:
      'A media transport is the reason the player exists, and a play button is the ' +
      'canonical 44px target. The play/seek buttons are <Button asChild> and are ' +
      'already floored by button-floor; these three are ButtonGroupText and are not, ' +
      'so the bar floors its own children.',
    find: '<ButtonGroup orientation="horizontal">{children}</ButtonGroup>',
    replace:
      '<ButtonGroup\n      className="[&>*]:min-h-[var(--target)]"\n      orientation="horizontal"\n    >\n      {children}\n    </ButtonGroup>',
  },

  // ---------------------------------------------------------------------
  // Dense. Each of these acts on content the component is already showing —
  // copy it, remove it, page it — rather than operating the component. They
  // are drawn at the shadcn/MUI reference scale contracts.json names, they all
  // clear 24x24, and they are measured against it rather than excused from
  // measurement.
  // ---------------------------------------------------------------------
  {
    id: 'message-action-dense',
    upstreamPath: 'packages/elements/src/message.tsx',
    control: 'message.tsx — MessageAction (copy, regenerate, rate)',
    verdict: 'dense',
    measured: '32x32, clears 24x24',
    why:
      'The clearest case in this file: the message is the subject, the action is an ' +
      'affordance attached to it, and the row of them reads as one cluster at a ' +
      'single scale.',
    find: '<Button size={size} type="button" variant={variant} {...props}>\n      {children}\n      <span className="sr-only">{label || tooltip}</span>',
    replace: `<Button\n      ${DENSE}\n      size={size}\n      type="button"\n      variant={variant}\n      {...props}\n    >\n      {children}\n      <span className="sr-only">{label || tooltip}</span>`,
  },
  {
    id: 'artifact-close-dense',
    upstreamPath: 'packages/elements/src/artifact.tsx',
    control: 'artifact.tsx — ArtifactClose',
    verdict: 'dense',
    measured: '32x32, clears 24x24',
    why:
      'It dismisses the artifact, which reads primary in isolation — but it is the ' +
      'third button in a cluster of three identical icon buttons in the same header ' +
      'bar, and splitting that cluster so one is 44 and two are 32 is not a density ' +
      'decision anybody would draw on purpose. The cluster is the unit, and the ' +
      'cluster is dense. Recorded here rather than left implicit because it is the ' +
      'closest call in this file.',
    find: '      "size-8 p-0 text-muted-foreground hover:text-foreground",\n      className\n    )}\n    size={size}',
    replace: `      "size-8 p-0 text-muted-foreground hover:text-foreground",\n      className\n    )}\n    ${DENSE}\n    size={size}`,
  },
  {
    id: 'artifact-action-dense',
    upstreamPath: 'packages/elements/src/artifact.tsx',
    control: 'artifact.tsx — ArtifactAction',
    verdict: 'dense',
    measured: '32x32, clears 24x24',
    why: 'Acts on the artifact’s content — copy it, regenerate it. Same cluster as ArtifactClose.',
    find: '        "size-8 p-0 text-muted-foreground hover:text-foreground",\n        className\n      )}\n      size={size}',
    replace: `        "size-8 p-0 text-muted-foreground hover:text-foreground",\n        className\n      )}\n      ${DENSE}\n      size={size}`,
  },
  {
    id: 'code-block-copy-dense',
    upstreamPath: 'packages/elements/src/code-block.tsx',
    control: 'code-block.tsx — CodeBlockCopyButton',
    verdict: 'dense',
    measured: '36x36, clears 24x24',
    why: 'Acts on the code block it sits on; the code is the subject.',
    find: 'className={cn("shrink-0", className)}\n      onClick={copyToClipboard}',
    replace: `className={cn("shrink-0", className)}\n      ${DENSE}\n      onClick={copyToClipboard}`,
  },
  {
    id: 'commit-copy-dense',
    upstreamPath: 'packages/elements/src/commit.tsx',
    control: 'commit.tsx — CommitCopyButton',
    verdict: 'dense',
    measured: '28x28, clears 24x24',
    why: 'Copies the hash sitting next to it.',
    find: 'className={cn("size-7 shrink-0", className)}\n      onClick={copyToClipboard}',
    replace: `className={cn("size-7 shrink-0", className)}\n      ${DENSE}\n      onClick={copyToClipboard}`,
  },
  {
    id: 'terminal-copy-dense',
    upstreamPath: 'packages/elements/src/terminal.tsx',
    control: 'terminal.tsx — TerminalCopyButton',
    verdict: 'dense',
    measured: '28x28, clears 24x24',
    why: 'Copies the scrollback.',
    find: '"size-7 shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",\n        className\n      )}\n      onClick={copyToClipboard}',
    replace: `"size-7 shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",\n        className\n      )}\n      ${DENSE}\n      onClick={copyToClipboard}`,
  },
  {
    id: 'stack-trace-copy-dense',
    upstreamPath: 'packages/elements/src/stack-trace.tsx',
    control: 'stack-trace.tsx — StackTraceCopyButton',
    verdict: 'dense',
    measured: '28x28, clears 24x24',
    why: 'Copies the trace.',
    find: 'className={cn("size-7", className)}\n        onClick={copyToClipboard}',
    replace: `className={cn("size-7", className)}\n        ${DENSE}\n        onClick={copyToClipboard}`,
  },
  {
    id: 'suggestion-dense',
    upstreamPath: 'packages/elements/src/suggestion.tsx',
    control: 'suggestion.tsx — Suggestion',
    verdict: 'dense',
    measured: '32px tall, clears 24x24',
    why:
      'A 32px rounded-full pill is MUI’s Chip exactly, and contracts.json already ' +
      'settled that a chip which is a control is dense at that scale (#114). Applying ' +
      'a different answer to the same shape here would be the inconsistency, not the ' +
      'exemption.',
    find: 'className={cn("cursor-pointer rounded-full px-4", className)}',
    replace: `className={cn("cursor-pointer rounded-full px-4", className)}\n      ${DENSE}`,
  },
  {
    id: 'prompt-input-tool-button-dense',
    upstreamPath: 'packages/elements/src/prompt-input.tsx',
    control: 'prompt-input.tsx — PromptInputButton (the composer’s inline tool row)',
    verdict: 'dense',
    measured: '32x32 icon-only and 88x32 labelled, both clear 24x24',
    why:
      'The one place in this file where two controls in the same row get different ' +
      'answers, and deliberately: PromptInputSubmit is the surface’s primary action ' +
      'and is floored to 44 by button-floor, while the tool row beside it — add an ' +
      'attachment, toggle search — is a strip of compact affordances at shadcn’s ' +
      'InputGroupButton scale. Flooring the strip too would make the whole composer ' +
      'footer 44px tall and remove the size difference that says which one sends the ' +
      'message.',
    find: '<InputGroupButton\n      className={cn(className)}\n      size={newSize}',
    replace: `<InputGroupButton\n      className={cn(className)}\n      ${DENSE}\n      size={newSize}`,
  },
  {
    id: 'transcription-segment-dense',
    upstreamPath: 'packages/elements/src/transcription.tsx',
    control: 'transcription.tsx — TranscriptionSegment',
    verdict: 'dense',
    measured: '23px tall, 24x24 effective — clears 24x24',
    why:
      'An inline target inside flowing text: clicking a word seeks the audio. WCAG 2.2 ' +
      'SC 2.5.8 exempts targets in a sentence outright, and this system’s own visual ' +
      'suite already records that an inline link in body copy is not what the 44px ' +
      'rule is about. The dense floor is therefore stricter than the standard here, ' +
      'and it still passes.',
    find: 'data-slot="transcription-segment"',
    replace: `data-slot="transcription-segment"\n      ${DENSE}`,
  },
];

function assertPatch(patch, source) {
  const count = patch.count ?? 1;
  const parts = source.split(patch.find).length - 1;

  if (parts !== count) {
    throw new Error(
      `ai-elements a11y patch "${patch.id}" expected its anchor ${count} time(s) in ` +
        `${patch.upstreamPath} and found ${parts}.\n\n` +
        `  control: ${patch.control}\n` +
        `  verdict: ${patch.verdict}\n` +
        `  anchor:  ${JSON.stringify(patch.find.slice(0, 120))}\n\n` +
        'Upstream has moved this control. Re-run the audit harness ' +
        '(`pnpm a11y:elements`), re-measure the control, and update the anchor — do ' +
        'not delete the patch to make the bump pass, and do not edit the vendored ' +
        'file directly.',
    );
  }
}

/**
 * Apply every patch that belongs to one upstream file.
 *
 * @param {string} source upstream bytes, after the earlier transform rules
 * @param {string} upstreamPath
 * @returns {{ source: string, fired: boolean }}
 */
export function applyA11yPatches(source, upstreamPath) {
  const patches = PATCHES.filter((patch) => patch.upstreamPath === upstreamPath);
  if (patches.length === 0) return { source, fired: false };

  let current = source;
  for (const patch of patches) {
    assertPatch(patch, current);
    current = current.split(patch.find).join(patch.replace);
  }

  return { source: current, fired: true };
}

/** Every file this rule touches, for the sync check's reporting. */
export const patchedPaths = [...new Set(PATCHES.map((patch) => patch.upstreamPath))];
