/* Typed access to the component manifest @elirobinson/ai-elements publishes,
   and to the upstream pin beside it.

   The same arrangement as lib/manifest.ts, for the same reason: the roster is
   built once, by the package that owns the files, and shipped in its dist. The
   difference is where the files came from. This package is vendored from
   vercel/ai-elements at a pinned release, so its roster changes when somebody
   runs `pnpm sync:elements` — and a component list written into a page would be
   wrong on the next bump, silently, for everyone reading it. Nothing here or
   downstream names a vendored component. */

import manifest from '@elirobinson/ai-elements/manifest';

export type {
  AiElementsManifest,
  AiElementsManifestEntry,
} from '@elirobinson/ai-elements/manifest';

import type { AiElementsManifestEntry } from '@elirobinson/ai-elements/manifest';

/** Which directory of the vendored tree an entry came from. */
export type ElementsTier = AiElementsManifestEntry['tier'];

/* Not a fixed union read off the entries: an empty tier would silently
   disappear from the page rather than render as an empty section, and the
   order these are presented in is editorial. `components` is what a consumer
   came for; `ui` is the shadcn/ui layer underneath it; `lib` is the helper. */
export const ELEMENTS_TIERS: ElementsTier[] = ['components', 'ui', 'lib'];

export const elements: AiElementsManifestEntry[] = manifest.entries;

/* The pinned upstream release. Read from the manifest rather than from
   `@elirobinson/ai-elements/upstream`, which is the same lockfile without a
   `types` condition: the manifest copies the four fields a reader needs from it
   at generation time, so both answer to the same pin and only one of them is
   typed. */
export const upstream = manifest.upstream;

/** `vercel/ai-elements` → the release page for the pinned ref. */
export function upstreamReleaseUrl(): string {
  return `https://github.com/${upstream.repo}/releases/tag/${upstream.ref}`;
}

/** The version of the package the manifest was generated from. */
export const elementsVersion: string = manifest.version;

/** The package name, so no page has to spell it. */
export const ELEMENTS_PACKAGE: string = manifest.package;

export function elementsByTier(tier: ElementsTier): AiElementsManifestEntry[] {
  return elements.filter((entry) => entry.tier === tier);
}

/* The exports a reader is looking for, minus the prop types beside them.
   `MessageContentProps` is real and is not what somebody scanning for a
   component wants to see; it is derivable from the component name, and the
   declaration files carry both. The filter is a suffix rule rather than a list,
   so it survives an upstream bump. */
export function componentExports(entry: AiElementsManifestEntry): string[] {
  return entry.exports.filter((name) => !name.endsWith('Props'));
}
