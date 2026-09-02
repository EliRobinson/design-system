/* What the registry would receive, read from the manifests that decide it.
 *
 * Not a published module: the `.test-helper.mjs` suffix matches neither Vitest's
 * include glob nor the one this package's `files` ships, so this is neither
 * collected as a suite nor sent to a consumer.
 *
 * It exists because two suites need the same answer to "what does `npm pack`
 * put in the tarball?", and the second copy is where the drift starts.
 * brand-boundary.test.mjs asks it to scan published files for one consumer's
 * business facts (#214); dependency-boundary.test.mjs asks it to scan published
 * files for imports the manifest never declared (#220). Both are the same
 * sentence — "no PUBLISHED file may X" — and a second reader of `files` would
 * be a second place to get npm's negation semantics subtly wrong, in a way that
 * fails by passing.
 *
 * The set is derived rather than listed for the same reason. A hand-kept list is
 * a second thing to update, and the first one drifted: brand-boundary opened by
 * scanning two directories it had chosen, while `files` had said `src` and
 * `dist` all along, so most of published source went unchecked and a banner
 * naming one consumer survived the run that caught three others. Reading the
 * manifest means dropping a negation tomorrow starts checking those files
 * without anyone touching a test — which is the correct direction for that
 * mistake.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** The monorepo root, so callers report paths a reader can paste into an editor. */
export const repoRoot = join(here, '..', '..', '..', '..');

const packagesDir = join(repoRoot, 'packages');

/* npm publishes these whether or not `files` names them. That is npm's rule and
   not this repo's, so it is written down once, here, rather than copied into six
   manifests. `package.json` ships too and is deliberately absent: its fields are
   registry metadata, and `author` naming a person is provenance rather than
   guidance the system asserts. */
const ALWAYS_PUBLISHED = ['README.md', 'LICENSE'];

/** Every file under `dir`, recursively. Unfiltered — callers drop what they cannot read. */
export function filesUnder(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

/* One negation from a `files` field, as a RegExp over a package-relative path.
 *
 * npm's patterns, not a general glob: `*` stops at a separator and `**` crosses
 * them. The detail that matters is what an INTERIOR `**` means. ai-patterns'
 * negation for test files has to exclude `src/foo.test.mjs` as well as
 * `src/voice/foo.test.mjs`, and npm reads it that way; a required run of
 * segments would quietly stop excluding the shallow half of the pattern's own
 * job. So an interior `**` is an optional run and only a trailing one is the
 * greedy "everything below here". Getting this backwards does not fail loudly —
 * it publishes a test fixture and passes. */
function toRegExp(pattern) {
  const segments = pattern.split('/');
  const source = segments
    .map((segment, index) => {
      const last = index === segments.length - 1;
      if (segment === '**') return last ? '.*' : '(?:.*/)?';
      const literal = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
      return last ? literal : `${literal}/`;
    })
    .join('');
  return new RegExp(`^${source}$`);
}

/**
 * Every package under `packages/`, each with the files its own `files` field publishes.
 *
 * Returned per package rather than as one flat list because half the questions
 * worth asking of a published file are about the manifest that published it —
 * "is this import one of ITS dependencies?" cannot be answered from a path.
 */
export function publishedPackages() {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const packageDir = join(packagesDir, entry.name);
      const manifestPath = join(packageDir, 'package.json');
      if (!statSync(manifestPath, { throwIfNoEntry: false })) return [];

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const declared = manifest.files ?? [];
      const excluded = declared
        .filter((pattern) => pattern.startsWith('!'))
        .map((pattern) => toRegExp(pattern.slice(1)));

      const included = declared.filter((pattern) => !pattern.startsWith('!'));

      const files = [...included, ...ALWAYS_PUBLISHED].flatMap((include) => {
        const target = join(packageDir, include);
        const stat = statSync(target, { throwIfNoEntry: false });

        /* An npm-implicit file may legitimately not exist — most packages here
           have no README. A `files` entry that resolves to nothing is different:
           the scan just got smaller and nobody chose that. `dist` is the one
           that goes missing, and a silently shorter file list is exactly how
           these suites would go green while checking half of what they claim,
           so it throws instead. */
        if (!stat) {
          if (ALWAYS_PUBLISHED.includes(include)) return [];
          throw new Error(
            `${manifest.name} publishes "${include}", which does not exist — run \`pnpm build\``,
          );
        }

        return (stat.isDirectory() ? filesUnder(target) : [target])
          .filter((path) => !excluded.some((pattern) => pattern.test(relative(packageDir, path))))
          .map((path) => ({ file: relative(repoRoot, path), path }));
      });

      return [{ manifest, packageDir, files }];
    });
}

/** Every published file in the workspace, flattened, for callers that need no manifest. */
export function publishedFiles() {
  return publishedPackages().flatMap((entry) => entry.files);
}
