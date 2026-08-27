// The half of contracts.json a linter cannot settle.
//
// `minimumTouchTarget`, `focusVisibleRequired` and `contrastLevel` are all
// claims about rendered geometry and computed colour, so the only honest way to
// check them is in a browser. These helpers take a Playwright `page` and return
// violations; drop them into an existing E2E suite rather than standing up a
// separate harness:
//
//   // e2e/design-system.spec.ts
//   import { expectDesignSystemContracts } from '@elirobinson/ai-patterns/testing/playwright'
//
//   test('home page meets the design system contracts', async ({ page }) => {
//     await page.goto('/')
//     await expectDesignSystemContracts(page)
//   })
//
// Playwright compiles a plain `.ts` spec to CommonJS, so that import resolves
// through the export map's `require` condition, which points back at this file
// and relies on Node's `require(esm)` — hence the package's `>=22.12.0` engines
// floor, and hence no top-level await below. On an older runtime, name the spec
// `.spec.mts` instead: Playwright treats it as ESM and the import is unchanged.
//
// Each helper can also be called on its own when a page needs a narrower scope
// or a documented exception.
//
// @playwright/test and axe-core are optional peer dependencies: nothing here is
// imported unless you import this module, and axe-core is only loaded by the
// contrast check. The browser-side code defines its own helpers inline rather
// than eval-ing them, so a page with a strict CSP still works.

/** contracts.json → uiContracts.minimumTouchTarget */
export const MINIMUM_TOUCH_TARGET = 44;

/**
 * contracts.json → uiContracts.minimumTouchTargetDense, and the `--target-min`
 * token. The floor a control matching `DENSE_AFFORDANCE_SELECTOR` is measured
 * against instead of `MINIMUM_TOUCH_TARGET`.
 *
 * 24 is not this system's number — it is WCAG 2.2 **AA**, SC 2.5.8 (Target Size
 * Minimum). 44 is AAA (SC 2.5.5) and this system's stricter default. That is
 * what makes a second floor principled rather than a discount: a dense control
 * still has to clear the standard, it is only excused from clearing the
 * system's own ambition. There is deliberately no third tier below this one —
 * see the `DENSE_AFFORDANCE_SELECTOR` docblock.
 */
export const MINIMUM_TOUCH_TARGET_DENSE = 24;

/** contracts.json → touch-target-primary. Controls a finger is expected to hit. */
export const PRIMARY_CONTROL_SELECTOR = [
  'button',
  '[role="button"]',
  'a[href]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  'summary',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
].join(', ');

/**
 * contracts.json → touch-target-dense. Controls the system holds to the
 * shadcn/MUI scale instead of 44px. Mark your own with
 * `data-touch-target="dense"` rather than growing this list.
 *
 * Matching this selector is **not** an exemption from measurement. It selects
 * which floor a control is measured against: `MINIMUM_TOUCH_TARGET_DENSE`
 * (24x24, WCAG 2.2 AA SC 2.5.8) instead of `MINIMUM_TOUCH_TARGET` (44x44, AAA
 * SC 2.5.5 and this system's default). A dense control that misses 24x24 is
 * reported under `touch-target-dense`, and there is no marker below this one to
 * escape into — which is the point. See "Why there is no third tier" below.
 *
 * Every class below names the element that *receives the click*. An exemption
 * written against an inner span silently matches nothing, which reads as a
 * clean sweep rather than as a broken rule — `.ds-rating__star` was that bug
 * for as long as this list existed: Rating puts the class on the glyph and the
 * control is `button.ds-rating__button`, so the exemption never fired. New
 * design-system affordances declare themselves with the data attribute instead
 * of being added here, which cannot drift the same way.
 *
 * `.ds-button--sm` is the deliberate exception to that last sentence, and the
 * reason is the same clause it appears to break — the class is on the element
 * that receives the click, so it cannot drift the way `.ds-rating__star` did.
 * The data attribute would not have helped here: the reported failure (#113)
 * was `a.ds-button.ds-button--accent.ds-button--sm`, an anchor carrying the
 * classes, not the React <Button>, so anything emitted from the component
 * would have missed it. Keying off the class covers both shapes.
 *
 * Why `--sm` is exempt rather than resized: 36px clears WCAG 2.2 AA (SC 2.5.8,
 * Target Size Minimum, 24x24) with margin. 44x44 is AAA (SC 2.5.5) and this
 * system's own stricter floor, not the standard. Raising `--sm` to 44 would
 * leave it differing from `md` only in font size and horizontal padding — a
 * typography variant, not a size variant — which removes the reason `sm`
 * exists and pushes anyone who needs a compact control into hand-rolling one
 * outside the system. The cost #113 recorded so it would not be discovered
 * twice — a consumer who uses `size="sm"` for a primary mobile CTA gets a
 * silent pass — is what the dense floor answers (#116). `size="sm"` is still
 * not measured against 44x44, and a 36px CTA is still a judgement the contract
 * cannot make for you; what changed is that `data-touch-target="dense"` on an
 * 8x8 glyph no longer passes as cleanly as a 36px button does.
 *
 * `.ds-chip` is the entry the floor made possible, and it closes #114. A chip
 * that is a control — `<a class="ds-chip">`, `<button class="ds-chip">`, both
 * sanctioned hand-written usages the React <Chip> deliberately cannot emit — is
 * 32px tall and was failing the 44px floor latently, unseen because every
 * fixture in this repo goes through <Chip>, which renders a <span>. 32px is
 * MUI's Chip exactly, which is the reference scale this tier already names, so
 * "a chip is dense" was always the right answer; what made it unwritable was
 * that adding it here used to mean *stopping measuring it*, which is what #114
 * objected to. Now it means measuring it at 24, which it clears at 64x32 and
 * 63x32. It is the only container in this list rather than a leaf control — and
 * that is deliberate: `closest` then holds everything inside a chip to the
 * dense floor, including an inline link in a chip's label (#114 case e), which
 * is a 20px-tall tap target that ought to clear AA and did not.
 *
 * Why there is no third tier
 * --------------------------
 * #116 asked whether a `data-touch-target="none"` escape hatch should exist for
 * the genuinely un-measurable. It does not, and should not: 24x24 is the
 * standard's own floor, so anything below it has no principled number left to
 * be held to, and a marker that means "stop looking" is the suppression habit
 * #113 was filed about — the exact failure this floor exists to end. The two
 * cases that motivated the question are already handled by measurement rather
 * than by a marker: a control nothing routes to is reported as
 * `touch-target-unmeasurable` (a gap in the check, said out loud, not a pass),
 * and a control whose hit area lives on its `<label>` is measured on the label.
 * A page with a genuine exception narrows `selector` or widens `exempt` at the
 * call site, where the exception is visible in the test and reviewable, instead
 * of hiding in an attribute on the element.
 */
export const DENSE_AFFORDANCE_SELECTOR = [
  '[data-touch-target="dense"]',
  '.ds-button--sm',
  '.ds-chip',
  '.ds-chip__remove',
  '.ds-search-field__clear',
  '.ds-rating__button',
  '.ds-date-picker__day',
].join(', ');

const FOCUS_MESSAGE =
  'focusVisibleRequired: focusing this control changes nothing visible. Restore the token focus ring — outline: 2px solid var(--focus-ring) — and delete any `outline: none`.';

const OVERLAP_MESSAGE =
  "hit-area-no-overlap: this control's hit area covers the centre of a sibling. Bound the overlay — stretch it to the container's height rather than using a symmetric negative inset.";

/**
 * The `touch-target-unmeasurable` of this check, and for the same reason: a
 * probe that failed must not be reported as a clean result. Saying "no overlap"
 * about a sibling nothing was routed to is exactly the silent false negative
 * #137 was, so the honest answer is that the question went unanswered.
 */
const OVERLAP_UNMEASURABLE_MESSAGE =
  "hit-area-unmeasurable: the browser routed no element to this sibling's centre, so whether this control's hit area covers it could not be established. This is a gap in the check, not a violation — look for pointer-events, a clipping ancestor, or a transform that moves the sibling away from its box.";

function assertPage(page) {
  if (!page || typeof page.evaluate !== 'function') {
    throw new TypeError(
      'Expected a Playwright Page. Call these helpers with the `page` fixture from @playwright/test.',
    );
  }
}

/**
 * Measures the *effective* hit area, not the painted box: the contract allows a
 * small glyph with padding or a bounded overlay around it, so a control counts
 * as 44x44 when the browser actually routes a hit at the edges of a 44x44 box
 * back to it.
 *
 * A form control's hit area is not always the control. A `<label>` forwards its
 * clicks to the control it labels, so in the standard "small native input, real
 * text label" pairing the label *is* the target a finger goes for — measuring
 * only the 18x18 checkbox measures something nobody aims at. A control
 * therefore passes when either its own hit area or a single label that
 * activates it clears the minimum.
 *
 * It has to be a *single* surface, not the union of the two: an input and a
 * label separated by a gap do not add up to one 44x44 region a finger can hit,
 * and treating them as if they did would pass every checkbox ever written. So
 * an unlabelled 18x18 checkbox still fails, and so does one whose label is a
 * 20px-tall sliver of text — which is what makes this a measurement fix rather
 * than an exemption.
 *
 * Hit testing only works inside the visible viewport, so each surface is
 * scrolled into view before it is probed, and the page is put back where it was
 * afterwards. Without that, nothing below the fold was ever measured at all —
 * see the note on `measure` below.
 *
 * Every control is measured. `exempt` does not skip one; it picks which of two
 * floors it is measured against, and a control that misses the dense floor is
 * reported under `touch-target-dense` rather than `touch-target-primary`. Read
 * `contract` on a violation rather than parsing the message for the prefix.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string} [options.selector] which controls to measure
 * @param {string} [options.exempt] controls measured against the dense floor
 *   instead of `minimum`. Pass `''` to hold everything to `minimum`.
 * @param {number} [options.minimum] px, defaults to the contract's 44
 * @param {number} [options.denseMinimum] px, defaults to the contract's 24.
 *   Clamped to `minimum`: the dense floor is a relaxation, so it can never come
 *   out stricter than the floor it relaxes.
 * @returns {Promise<Array<{ element: string, contract: 'touch-target-primary' | 'touch-target-dense' | 'touch-target-unmeasurable', minimum: number, width: number, height: number, effectiveWidth?: number, effectiveHeight?: number, labelWidth?: number, labelHeight?: number, unmeasurable?: true, message: string }>>}
 */
export async function checkTouchTargets(page, options = {}) {
  assertPage(page);

  const {
    selector = PRIMARY_CONTROL_SELECTOR,
    exempt = DENSE_AFFORDANCE_SELECTOR,
    minimum = MINIMUM_TOUCH_TARGET,
    denseMinimum = MINIMUM_TOUCH_TARGET_DENSE,
  } = options;

  return page.evaluate(
    ({ selector, exempt, minimum, denseMinimum }) => {
      const describe = (element) => {
        const id = element.id ? `#${element.id}` : '';
        const classes =
          typeof element.className === 'string' && element.className.trim()
            ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
            : '';
        const label =
          element.getAttribute('aria-label') || (element.textContent || '').trim().slice(0, 40);
        return `${element.tagName.toLowerCase()}${id}${classes}${label ? ` "${label}"` : ''}`;
      };

      const isRendered = (element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = getComputedStyle(element);
        return style.visibility !== 'hidden' && style.display !== 'none';
      };

      // Walk outward from a surface's centre until the browser stops routing
      // hits back to it. That is the hit area a finger actually gets, which is
      // what the contract is about — padding and bounded overlays both count.
      //
      // Only the surface itself or something inside it counts. An *ancestor*
      // answering the hit test means the point missed — and since <body>
      // contains every control, treating ancestors as hits would make every
      // target look infinitely large.
      //
      // `document.elementFromPoint` only answers for the *visible viewport*, so
      // every probe has to happen somewhere the browser can currently see, and
      // until this scrolled, none of them did. That is issue #79, and it had
      // two faces. Before the centre guard below existed, a control past the
      // fold got `null` from the very first probe, `reach` returned 0 in all
      // four directions, and `0 + 0 + 1` reported a literal "1x1" for a 112x44
      // button nobody had measured. Once the guard landed, the same `null` at
      // the centre made it *skip* instead — quieter, and worse: every primary
      // control below the fold passed without being checked, so a genuinely
      // undersized one was indistinguishable from a compliant one. Either way
      // the check only ever saw the first screenful of a page.
      //
      // `floor` is the minimum this particular surface is being held to — 44
      // for a primary control, 24 for a dense one. It is a parameter rather
      // than a closure over one number because the walk below stops after
      // `floor` steps: once a surface has reached the floor there is nothing
      // left to learn, and a 24-run therefore reports a *lower bound* (at most
      // 24 + 24 + 1 = 49) rather than a width. That is harmless — the only
      // question asked of the result is `>= floor` — but it is why two runs at
      // different floors can report different numbers for the same box.
      //
      // The scroll-and-probe opening below is duplicated in
      // `checkHitAreaOverlap`'s `routesTo()`, which carries the matching note.
      // #131 established that each check's helpers live inside its own
      // `page.evaluate` closure and cannot close over module scope, so sharing
      // would mean eval-ing a source string — ruled out by the strict-CSP
      // promise in this file's header. The two are meant to agree; a silent
      // divergence between them is its own bug.
      const measure = (surface, floor) => {
        // Scrolling is synchronous with respect to layout, so the box read back
        // immediately afterwards is already in the coordinate space the probes
        // below will use. `instant` because a page with `scroll-behavior:
        // smooth` would otherwise still be animating when the rect is read.
        surface.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });

        const rect = surface.getBoundingClientRect();
        const viewWidth = document.documentElement.clientWidth;
        const viewHeight = document.documentElement.clientHeight;

        // Parked off-canvas on purpose — a skip link at `top: -40px`, a closed
        // drawer. Scrolling cannot bring back what is positioned out of view,
        // and a surface no probe can reach is not a sizing question.
        if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= viewWidth || rect.top >= viewHeight)
          return { measured: false, offCanvas: true, rect };

        // Probe from the centre of whatever part of the box is on screen. For
        // anything that fits the window — which is every control this contract
        // is about — that is the box's own centre. For something larger than
        // the window, centring is impossible and its true centre would sit
        // outside the viewport, which is the same `null` that started this bug.
        const midpoint = (start, end, extent) => (Math.max(start, 0) + Math.min(end, extent)) / 2;
        const centreX = midpoint(rect.left, rect.right, viewWidth);
        const centreY = midpoint(rect.top, rect.bottom, viewHeight);

        // Three answers, not two. `null` from `elementFromPoint` means the
        // browser routed *nothing* to the point — outside the viewport, or
        // nothing hit-testable painted there — which is not the same as "some
        // other element is there". Folding the two together is how a probe that
        // failed turns into a size that was never obtained.
        const HIT = 'hit';
        const MISS = 'miss';
        const BLIND = 'blind';

        const probe = (x, y) => {
          if (x < 0 || y < 0 || x >= viewWidth || y >= viewHeight) return BLIND;
          const hit = document.elementFromPoint(x, y);
          if (hit === null) return BLIND;
          return hit === surface || surface.contains(hit) ? HIT : MISS;
        };

        // A surface something *else* answers for is not a sizing question
        // either, and the walk below cannot tell the two apart: it starts at
        // ±1px, so a covered control reaches 0 in all four directions and comes
        // back as "1x1". With a modal <dialog> open that is every control
        // behind it — Chromium attributes hits over the ::backdrop to the
        // dialog — so an untouched 186x44 button reported ~1x1 and advised
        // padding, which would have done nothing.
        const centre = probe(centreX, centreY);
        if (centre === MISS) return { measured: false, occluded: true, rect };
        if (centre === BLIND) return { measured: false, blind: true, rect };

        const reach = (dx, dy) => {
          let distance = 0;
          for (let step = 1; step <= floor; step += 1) {
            const answer = probe(centreX + dx * step, centreY + dy * step);
            if (answer === BLIND) return { distance, blind: true };
            if (answer === MISS) break;
            distance = step;
          }
          return { distance, blind: false };
        };

        const left = reach(-1, 0);
        const right = reach(1, 0);
        const up = reach(0, -1);
        const down = reach(0, 1);

        // A walk that ran out of window did not find the edge of the hit area,
        // so its total is a floor, not a measurement. The painted box *is* a
        // number we obtained, so take whichever is larger: a surface bigger
        // than the viewport passes on its own geometry rather than failing for
        // being too big to probe, while an undersized control pinned against a
        // window edge still reports its real, too-small box.
        const span = (a, b, painted) => {
          const walked = a.distance + b.distance + 1;
          return a.blind || b.blind ? Math.max(walked, Math.round(painted)) : walked;
        };

        return {
          measured: true,
          width: span(left, right, rect.width),
          height: span(up, down, rect.height),
          rect,
        };
      };

      const meets = (area, floor) => area.measured && area.width >= floor && area.height >= floor;

      // The dense floor relaxes the primary one, so it can never be the
      // stricter of the two. A caller who passes `minimum: 20` is loosening the
      // whole contract for a reason of their own; leaving `denseMinimum` at 24
      // there would hold a chip's remove glyph to a higher bar than the page's
      // primary CTA, which is not a floor anyone asked for.
      const denseFloor = Math.min(minimum, denseMinimum);

      // `.labels` covers both `<label for>` and a wrapping `<label>`, and is
      // only defined on the elements that can actually be labelled — an <a> or
      // a [role="button"] div gets nothing, which is correct: no label
      // forwards a click to them.
      const labelsOf = (element) => (element.labels ? Array.from(element.labels) : []);

      // Measuring now means scrolling, and a check must not leave the page
      // somewhere else: a screenshot or an assertion later in the same test
      // would see the scroll position this function happened to stop at.
      // `scrollIntoView` walks the whole ancestor chain, so every scrollable
      // container is snapshotted, not just the window.
      const scrollState = [...document.querySelectorAll('*')]
        .filter(
          (node) => node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth,
        )
        .map((node) => [node, node.scrollLeft, node.scrollTop]);
      const pageScrollX = window.scrollX;
      const pageScrollY = window.scrollY;

      const violations = [];

      try {
        for (const element of document.querySelectorAll(selector)) {
          if (element.disabled) continue;
          if (!isRendered(element)) continue;

          // The whole of #116, in three lines. This used to be a `continue`:
          // a dense control was not measured at all, so an 8x8 glyph carrying
          // data-touch-target="dense" passed exactly as cleanly as a 36px
          // button. Now the match selects a floor instead of skipping the
          // measurement, and missing that floor is its own violation kind.
          //
          // `closest` rather than `matches` because the click can land on an
          // inner glyph inside a dense affordance; the ancestor carrying the
          // marker is what declares the tier.
          const dense = Boolean(exempt && element.closest(exempt));
          const floor = dense ? denseFloor : minimum;
          const contract = dense ? 'touch-target-dense' : 'touch-target-primary';

          const own = measure(element, floor);

          if (!own.measured) {
            // Occluded and off-canvas surfaces are skipped, as they always
            // were. `blind` is the one that must never pass silently: the
            // browser answered `null` for a box that *is* on screen, so the
            // check obtained no number at all. Saying so is the honest report;
            // inventing a size from a failed probe is what #79 was.
            if (own.blind) {
              violations.push({
                element: describe(element),
                contract: 'touch-target-unmeasurable',
                minimum: floor,
                width: Math.round(own.rect.width),
                height: Math.round(own.rect.height),
                unmeasurable: true,
                message:
                  `touch-target-unmeasurable: the browser routed no element to this control's` +
                  ` centre, so its hit area could not be measured and it has not been checked` +
                  ` against ${floor}x${floor} (the ${dense ? 'dense' : 'primary'} floor).` +
                  ` This is a gap in the check, not a size violation — look for pointer-events,` +
                  ` a clipping ancestor, or a transform that moves the control away from its box.`,
              });
            }
            continue;
          }

          if (meets(own, floor)) continue;

          // Too small on its own. If a label that activates it is big enough by
          // itself, that label is the surface being aimed at.
          const labelAreas = labelsOf(element)
            .filter(isRendered)
            .map((element) => measure(element, floor))
            .filter((area) => area.measured);
          if (labelAreas.some((area) => meets(area, floor))) continue;

          // Report the roomiest label considered, so the message says what was
          // measured rather than leaving the reader to guess why 18x18 was not
          // rescued by the label sitting next to it.
          const label = labelAreas.reduce(
            (best, area) =>
              !best || area.width * area.height > best.width * best.height ? area : best,
            null,
          );

          // Both messages name the floor that was applied, because the same
          // ~22x22 reads as a bug or as a non-event depending on which one it
          // was measured against, and a reader who cannot tell will go looking
          // for the wrong fix.
          const size =
            `hit area is ~${own.width}x${own.height}, below ${floor}x${floor}` +
            (label ? `, and its label is only ~${label.width}x${label.height}` : '');
          const expand =
            `Expand the hit area with padding or a bounded overlay — do not inflate the` +
            ` painted control` +
            (label ? `; giving the label the full row height is usually the fix` : '');

          violations.push({
            element: describe(element),
            contract,
            minimum: floor,
            width: Math.round(own.rect.width),
            height: Math.round(own.rect.height),
            effectiveWidth: own.width,
            effectiveHeight: own.height,
            ...(label ? { labelWidth: label.width, labelHeight: label.height } : {}),
            message: dense
              ? `touch-target-dense: ${size}. This control is held to the dense floor` +
                ` (${floor}x${floor}, WCAG 2.2 AA SC 2.5.8 Target Size Minimum) rather than the` +
                ` ${minimum}x${minimum} primary floor, because it matches the dense selector —` +
                ` and it misses that too. ${expand}. There is no marker below this one:` +
                ` ${floor}x${floor} is the standard's own floor, so declaring the control denser` +
                ` is not available as a fix.`
              : `touch-target-primary: ${size}. ${expand}. A deliberately compact control` +
                ` — a dense inline affordance, or a variant whose whole point is being small —` +
                ` declares itself with data-touch-target="dense"; the design system's own compact` +
                ` variants (size="sm" and friends) already do. That moves it to the` +
                ` ${denseFloor}x${denseFloor} dense floor, which it still has to clear — it is not` +
                ` a way to stop the control being measured.`,
          });
        }
      } finally {
        for (const [node, scrollLeft, scrollTop] of scrollState) {
          node.scrollLeft = scrollLeft;
          node.scrollTop = scrollTop;
        }
        window.scrollTo(pageScrollX, pageScrollY);
      }

      return violations;
    },
    { selector, exempt, minimum, denseMinimum },
  );
}

/**
 * contracts.json → hit-area-no-overlap. An expanded hit area must not swallow a
 * neighbour: if a sibling's own centre routes to this control, it has been
 * covered.
 *
 * Only siblings a user can actually see count. A visually-hidden sibling has no
 * visual presence and no hit area of its own, so covering it deprives nobody of
 * anything — see `isVisuallyRendered` below for why the zero-size guard alone
 * could not tell the two apart.
 *
 * Each sibling is scrolled into view before its centre is probed, because
 * `document.elementFromPoint` only answers for the visible viewport and a
 * sibling past the fold used to come back `null` — neither the control nor
 * contained by it, so the comparison quietly failed and nothing was reported.
 * A sibling that is on screen and still routes nothing is reported as
 * `hit-area-unmeasurable` (a stated gap in the check, not a violation) rather
 * than passing; one parked off-canvas, which scrolling cannot rescue, stays
 * silent. The page is put back where it was found.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string} [options.selector]
 * @returns {Promise<Array<{ element: string, covers: string, unmeasurable?: true, message: string }>>}
 */
export async function checkHitAreaOverlap(page, options = {}) {
  assertPage(page);
  const { selector = PRIMARY_CONTROL_SELECTOR } = options;

  return page.evaluate(
    ({ selector, message, unmeasurableMessage }) => {
      const describe = (element) => {
        const id = element.id ? `#${element.id}` : '';
        const classes =
          typeof element.className === 'string' && element.className.trim()
            ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
            : '';
        const label =
          element.getAttribute('aria-label') || (element.textContent || '').trim().slice(0, 40);
        return `${element.tagName.toLowerCase()}${id}${classes}${label ? ` "${label}"` : ''}`;
      };

      // Is this sibling something a user could see and aim at? Anything else
      // cannot be "covered" in any sense the contract cares about.
      //
      // The load-bearing clause is the size one. `sr-only` is deliberately
      // 1x1 rather than 0x0 — a genuinely zero-sized element is dropped from
      // the accessibility tree in some browsers — so the old
      // `width === 0 || height === 0` guard missed the canonical pattern by
      // exactly one pixel, and every `sr-only` label sitting at its control's
      // static origin was reported as a swallowed neighbour. Measuring the box
      // rather than enumerating the recipes covers every variant in the wild
      // (`clip: rect(0 0 0 0)`, `clip-path: inset(50%)`, `1px` + `overflow:
      // hidden`): a 1x1 element is not something a user can be prevented from
      // touching. The original collapsed-in-either-axis guard is kept rather
      // than folded in: a 0x570 sibling has no centre to probe, and widening
      // that to `<= 1` in either axis would start skipping real 1px rules and
      // dividers. The computed-style clauses sit alongside both for hidden
      // siblings that are full-sized — a `visibility: hidden` placeholder
      // holding layout space is equally untouchable.
      const isVisuallyRendered = (element, rect) => {
        if (rect.width === 0 || rect.height === 0) return false;
        if (rect.width <= 1 && rect.height <= 1) return false;

        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        if (style.opacity === '0') return false;
        if (style.clipPath === 'inset(50%)') return false;

        return true;
      };

      // Four answers, not two. `document.elementFromPoint` only answers for the
      // *visible viewport*, so until this scrolled, a sibling past the fold was
      // probed at a coordinate the browser cannot see. It returned `null`,
      // `null` is neither the control nor contained by it, both branches were
      // false, and the loop moved on having established nothing. That is issue
      // #137, and it is the quiet direction of #79: a page taller than the
      // window is the normal case, so the check reported zero violations for
      // most of most pages and a green result was indistinguishable from a
      // genuinely clean one.
      //
      // Folding `null` back into MISS is what made that silent, so the two are
      // kept apart. `OFF_CANVAS` is a sibling scrolling cannot rescue — a skip
      // link at `top: -40px`, a closed drawer — which is unreachable by design
      // and cannot be covered in any sense the contract is about. `BLIND` is a
      // sibling that *is* on screen and still routed nothing: a gap in the
      // check, and this says so rather than counting it as "not covered".
      const HIT = 'hit';
      const MISS = 'miss';
      const BLIND = 'blind';
      const OFF_CANVAS = 'off-canvas';

      // Deliberately a near-copy of `measure()`'s scroll-and-probe opening in
      // `checkTouchTargets` above, not a shared helper. #131 established that
      // each check's helpers live inside its own `page.evaluate` closure, which
      // is serialised to the browser and cannot close over module scope, so
      // "sharing" would mean eval-ing a source string — which the strict-CSP
      // promise in this file's header rules out. `describe()` above is
      // duplicated for the same reason. Both copies carry this note: the two
      // scroll blocks are meant to agree, and a silent divergence between them
      // is its own bug.
      const routesTo = (sibling, control) => {
        // Scrolling is synchronous with respect to layout, so the box read back
        // immediately afterwards is already in the coordinate space the probe
        // below uses. `instant` because a page with `scroll-behavior: smooth`
        // would otherwise still be animating when the rect is read.
        //
        // The *sibling* is what moves, because the sibling's centre is what
        // gets probed. The control has to still be on top of it afterwards,
        // which holds because the loop only ever walks
        // `control.parentElement.children` — they share a parent and so scroll
        // together. That is asserted, not assumed: see the below-the-fold case
        // in playwright.test.mjs.
        sibling.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });

        const rect = sibling.getBoundingClientRect();
        const viewWidth = document.documentElement.clientWidth;
        const viewHeight = document.documentElement.clientHeight;

        if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= viewWidth || rect.top >= viewHeight)
          return OFF_CANVAS;

        // Probe the centre of whatever part of the sibling is on screen. For
        // anything that fits the window that is the sibling's own centre.
        // `checkTouchTargets` lets a surface too large to walk pass on its
        // painted geometry, because the question there is "is this box big
        // enough" and an oversized box plainly is. The question here is "is
        // this sibling covered", and being tall is no reason to stop asking —
        // so an oversized sibling is probed rather than excused.
        const midpoint = (start, end, extent) => (Math.max(start, 0) + Math.min(end, extent)) / 2;
        const x = midpoint(rect.left, rect.right, viewWidth);
        const y = midpoint(rect.top, rect.bottom, viewHeight);

        if (x < 0 || y < 0 || x >= viewWidth || y >= viewHeight) return BLIND;

        const hit = document.elementFromPoint(x, y);
        if (hit === null) return BLIND;
        return hit === control || control.contains(hit) ? HIT : MISS;
      };

      // Reaching a sibling now means scrolling, and a check must not leave the
      // page somewhere else: a screenshot or an assertion later in the same
      // test would see the scroll position this function happened to stop at.
      // `scrollIntoView` walks the whole ancestor chain, so every scrollable
      // container is snapshotted, not just the window.
      const scrollState = [...document.querySelectorAll('*')]
        .filter(
          (node) => node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth,
        )
        .map((node) => [node, node.scrollLeft, node.scrollTop]);
      const pageScrollX = window.scrollX;
      const pageScrollY = window.scrollY;

      const violations = [];

      try {
        for (const control of document.querySelectorAll(selector)) {
          for (const sibling of control.parentElement?.children ?? []) {
            if (sibling === control || control.contains(sibling)) continue;

            // Before the scroll — but as a cost decision, not a correctness
            // one, and #137 asked for that to be settled rather than assumed.
            // Every clause of this guard is scroll-invariant: it reads the
            // box's *dimensions* and its computed style, and a scroll changes
            // neither. Running it first therefore only avoids scrolling the
            // page for a sibling that was never going to be probed. Moving it
            // after `routesTo` was measured and changes no result in the suite,
            // so there is no ordering hazard here to pin — which is worth
            // stating, because the obvious assumption is that there would be.
            //
            // What does matter is that it still runs at all. It is what keeps
            // #131 intact: an `sr-only` label is 1x1 at its control's static
            // origin, so its centre routes to the control, and probing it would
            // report every accessible-name-only label on the page. Reaching
            // below the fold gave the check a lot more siblings to be wrong
            // about, so that case is now asserted down there too.
            if (!isVisuallyRendered(sibling, sibling.getBoundingClientRect())) continue;

            const answer = routesTo(sibling, control);

            if (answer === HIT) {
              violations.push({ element: describe(control), covers: describe(sibling), message });
            } else if (answer === BLIND) {
              violations.push({
                element: describe(control),
                covers: describe(sibling),
                unmeasurable: true,
                message: unmeasurableMessage,
              });
            }
          }
        }
      } finally {
        for (const [node, scrollLeft, scrollTop] of scrollState) {
          node.scrollLeft = scrollLeft;
          node.scrollTop = scrollTop;
        }
        window.scrollTo(pageScrollX, pageScrollY);
      }

      return violations;
    },
    {
      selector,
      message: OVERLAP_MESSAGE,
      unmeasurableMessage: OVERLAP_UNMEASURABLE_MESSAGE,
    },
  );
}

/**
 * contracts.json → uiContracts.focusVisibleRequired. Focuses each control and
 * checks that something visible actually changed.
 *
 * Focus is moved programmatically, which Chromium treats as keyboard-like and
 * so matches `:focus-visible`. Pass `useKeyboard: true` to drive real Tab
 * presses when a component's focus styling depends on key events.
 *
 * Controls that refuse focus are skipped, not reported. Everything behind an
 * open modal `<dialog>` is inert, so `.focus()` does nothing and the before and
 * after snapshots match — which would otherwise read as a missing focus ring on
 * a control whose ring is fine.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string} [options.selector]
 * @param {boolean} [options.useKeyboard]
 * @returns {Promise<Array<{ element: string, message: string }>>}
 */
export async function checkFocusVisible(page, options = {}) {
  assertPage(page);
  const { selector = PRIMARY_CONTROL_SELECTOR, useKeyboard = false } = options;

  if (useKeyboard) {
    const controls = page.locator(selector);
    const count = await controls.count();
    const violations = [];

    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index);
      if (!(await control.isVisible())) continue;

      const before = await control.evaluate(snapshotStyle);
      await control.focus();
      // Leave and re-enter by keyboard so :focus-visible is unambiguous.
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');

      // Same guard as the programmatic branch: a control the browser refuses
      // to focus (inert behind an open modal) would otherwise read as one
      // whose focus ring does nothing.
      if (!(await control.evaluate((element) => document.activeElement === element))) continue;

      const after = await control.evaluate(snapshotStyle);

      if (before === after) {
        violations.push({
          element: await control.evaluate(describeElement),
          message: FOCUS_MESSAGE,
        });
      }
    }

    return violations;
  }

  return page.evaluate(
    ({ selector, message }) => {
      const describe = (element) => {
        const id = element.id ? `#${element.id}` : '';
        const classes =
          typeof element.className === 'string' && element.className.trim()
            ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
            : '';
        const label =
          element.getAttribute('aria-label') || (element.textContent || '').trim().slice(0, 40);
        return `${element.tagName.toLowerCase()}${id}${classes}${label ? ` "${label}"` : ''}`;
      };

      const snapshot = (element) => {
        const style = getComputedStyle(element);
        return [
          style.outlineStyle,
          style.outlineWidth,
          style.outlineColor,
          style.outlineOffset,
          style.boxShadow,
          style.borderColor,
          style.backgroundColor,
          style.color,
        ].join('|');
      };

      const violations = [];
      const previouslyFocused = document.activeElement;

      for (const element of document.querySelectorAll(selector)) {
        if (element.disabled) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const before = snapshot(element);
        element.focus();

        // Focus can be refused — a control behind an open modal <dialog> is
        // inert, so `.focus()` is a no-op and activeElement stays inside the
        // dialog. The snapshots then match for the trivial reason that the
        // element was never focused, and the check would report a missing
        // focus ring on a control that has one. Only judge what took focus.
        if (document.activeElement !== element) continue;

        const after = snapshot(element);
        element.blur();

        if (before === after) violations.push({ element: describe(element), message });
      }

      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      return violations;
    },
    { selector, message: FOCUS_MESSAGE },
  );
}

// Passed to Locator#evaluate, which runs them in the page.
function snapshotStyle(element) {
  const style = getComputedStyle(element);
  return [
    style.outlineStyle,
    style.outlineWidth,
    style.outlineColor,
    style.outlineOffset,
    style.boxShadow,
    style.borderColor,
    style.backgroundColor,
    style.color,
  ].join('|');
}

function describeElement(element) {
  const id = element.id ? `#${element.id}` : '';
  const classes =
    typeof element.className === 'string' && element.className.trim()
      ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
      : '';
  const label =
    element.getAttribute('aria-label') || (element.textContent || '').trim().slice(0, 40);
  return `${element.tagName.toLowerCase()}${id}${classes}${label ? ` "${label}"` : ''}`;
}

/**
 * contracts.json → uiContracts.contrastLevel. Runs axe-core's colour-contrast
 * rule, which is the WCAG AA implementation everything else defers to.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string} [options.include] restrict to a subtree
 * @param {string[]} [options.exclude] subtrees to skip (third-party embeds)
 * @param {'AA' | 'AAA'} [options.level]
 * @returns {Promise<Array<{ element: string, message: string, contrast: string }>>}
 */
export async function checkContrast(page, options = {}) {
  assertPage(page);
  const { include, exclude = [], level = 'AA' } = options;

  let axeSource;
  try {
    const axe = await import('axe-core');
    axeSource = (axe.default ?? axe).source;
  } catch {
    throw new Error(
      'checkContrast() needs axe-core. Install it alongside your E2E suite:\n\n  pnpm add -D axe-core',
    );
  }

  await page.addScriptTag({ content: axeSource });

  return page.evaluate(
    async ({ include, exclude, rule }) => {
      const context = {};
      if (include) context.include = [include];
      if (exclude.length) context.exclude = exclude.map((selector) => [selector]);

      const run = await window.axe.run(Object.keys(context).length ? context : document, {
        runOnly: { type: 'rule', values: [rule] },
      });

      return run.violations.flatMap((violation) =>
        violation.nodes.map((node) => ({
          element: node.target.join(' '),
          message: `contrastLevel: ${violation.help}`,
          contrast: node.failureSummary ?? '',
        })),
      );
    },
    { include, exclude, rule: level === 'AAA' ? 'color-contrast-enhanced' : 'color-contrast' },
  );
}

/**
 * Every browser-settled contract in one call. Throws with all violations at
 * once, so a run reports the whole picture instead of the first failure.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {object|false} [options.touchTargets] options, or false to skip
 * @param {object|false} [options.hitAreaOverlap]
 * @param {object|false} [options.focusVisible]
 * @param {object|false} [options.contrast]
 */
export async function expectDesignSystemContracts(page, options = {}) {
  const violations = [];

  if (options.touchTargets !== false) {
    violations.push(...(await checkTouchTargets(page, options.touchTargets ?? {})));
  }
  if (options.hitAreaOverlap !== false) {
    violations.push(...(await checkHitAreaOverlap(page, options.hitAreaOverlap ?? {})));
  }
  if (options.focusVisible !== false) {
    violations.push(...(await checkFocusVisible(page, options.focusVisible ?? {})));
  }
  if (options.contrast !== false) {
    violations.push(...(await checkContrast(page, options.contrast ?? {})));
  }

  if (violations.length) {
    const detail = violations
      .map((violation) => `  - ${violation.element}\n      ${violation.message}`)
      .join('\n');

    throw new Error(
      `${violations.length} design system contract violation(s). Run \`pnpm ds contracts\` for the full rules.\n\n${detail}`,
    );
  }

  return violations;
}
