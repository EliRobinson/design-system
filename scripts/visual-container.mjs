#!/usr/bin/env node
/* Runs Playwright inside the pinned container, so a baseline generated on a
   laptop is byte-identical to one generated in CI (issue #65, decision 1).

   Everything the run touches is container-private except three paths: the repo
   goes in read-only, and the baselines and HTML report come back out. Nothing
   the container does can modify the working tree.

   Usage:
     node scripts/visual-container.mjs [--fresh] [playwright args...]
     node scripts/visual-container.mjs --print-image
     node scripts/visual-container.mjs --update-digest
*/

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/* Derived, never written down, so the image cannot drift from the Playwright
   that produced the baselines. Bumping @playwright/test is therefore a
   baseline-invalidating change by construction — which it genuinely is, since
   browser builds move. */
function playwrightVersion() {
  try {
    return require('@playwright/test/package.json').version;
  } catch {
    /* CI has to know the image before it can install anything: a job's
       `container:` is resolved before any step runs. The lockfile pins the
       same exact version the install would produce, so --print-image works on
       a bare checkout and the workflow never needs its own copy of this. */
    const lockfile = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
    const versions = new Set(
      [...lockfile.matchAll(/^\s*'?@playwright\/test@([^':\s]+)'?:/gm)].map(([, found]) => found),
    );

    if (versions.size !== 1) {
      throw new Error(
        `Expected exactly one @playwright/test version in pnpm-lock.yaml, found ${
          versions.size === 0 ? 'none' : [...versions].join(', ')
        }. The container image has to pin one renderer; resolve the duplicate first.`,
      );
    }

    return [...versions][0];
  }
}

const REGISTRY = 'mcr.microsoft.com';
const REPOSITORY = 'playwright';

/* The tag the lockfile implies. Not the image reference — see below. */
function imageTag() {
  return `${REGISTRY}/${REPOSITORY}:v${playwrightVersion()}-noble`;
}

const DIGEST_LOCK = join(root, 'scripts', 'visual-image.lock.json');
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const REFRESH_COMMAND = 'pnpm visual:digest';

/* The tag above is mutable. Microsoft republishes `v1.62.1-noble` in place when
   the base image is rebuilt — new fontconfig, new freetype, new anything — and
   a suite whose entire premise is a pinned renderer would follow it silently.
   That has not bitten us yet (issue #125 checked, and the digests on the runs
   either side of the failure were identical), but it is the one drift this
   design cannot detect after the fact: every baseline would move at once, and
   the diff would look like a real regression across the whole sweep.

   So: derive the tag, then pin the digest that tag resolved to, and check the
   two against each other on every run.

   A digest cannot be derived, only recorded, and the recording has to survive a
   constraint the rest of this file already lives under — `--print-image` runs on
   a bare checkout with nothing installed, because a GitHub job's `container:` is
   resolved before any step of that job runs. It cannot call the network (the
   resolve step is a plain `node scripts/...` with no daemon and no login) and it
   cannot fail slowly. Hence a checked-in lockfile, keyed by the tag it was taken
   for: reading it is a file read, and a stale one is a loud error rather than a
   quiet fallback to the mutable tag.

   Keyed by tag, specifically. Bumping @playwright/test moves the derived tag,
   the two stop matching, and the run stops with the refresh command in the
   message — which is correct, because a Playwright bump invalidates baselines by
   construction and should never be able to half-happen.

   The reference is emitted as tag@digest rather than bare repo@digest. Docker
   resolves it by digest and ignores the tag, so the pin is exact either way, and
   keeping the tag means a CI log still says which Playwright this was. */
function pinnedImage() {
  const tag = imageTag();
  let lock;

  try {
    lock = JSON.parse(readFileSync(DIGEST_LOCK, 'utf8'));
  } catch (error) {
    fail(
      `Could not read the pinned container digest from ${DIGEST_LOCK}:\n` +
        `${error.message}\n\n` +
        `Run \`${REFRESH_COMMAND}\` to regenerate it.`,
    );
  }

  if (lock.tag !== tag) {
    fail(
      'The pinned container digest is stale.\n\n' +
        `  pnpm-lock.yaml implies:  ${tag}\n` +
        `  visual-image.lock.json:  ${lock.tag}\n\n` +
        `Run \`${REFRESH_COMMAND}\` and commit the result.\n` +
        'A Playwright bump invalidates every baseline, so regenerate them in the\n' +
        'same change (`pnpm test:visual:update`, or the Visual update workflow).',
    );
  }

  if (!DIGEST_PATTERN.test(lock.digest ?? '')) {
    fail(
      `${DIGEST_LOCK} does not contain a sha256 digest (found ${JSON.stringify(lock.digest)}).\n` +
        `Run \`${REFRESH_COMMAND}\` to regenerate it.`,
    );
  }

  return `${tag}@${lock.digest}`;
}

/* Asks the registry what the tag points at right now, over the plain
   distribution API rather than through Docker: this has to work on a machine
   with no daemon running, and pulling ~2GB of image to learn 32 bytes is a poor
   trade. MCR serves manifests anonymously, so there is no token exchange; if
   that ever changes, this fails loudly instead of pinning something wrong.

   HEAD, not GET — the digest is a response header, and the body is not needed.
   Accept lists both the index and single-manifest media types, because a
   registry that is not told which it may serve can answer with a converted
   manifest whose digest is not the one everyone else sees. */
async function fetchDigest(tag) {
  const reference = tag.slice(tag.lastIndexOf(':') + 1);
  const url = `https://${REGISTRY}/v2/${REPOSITORY}/manifests/${reference}`;

  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      accept: [
        'application/vnd.oci.image.index.v1+json',
        'application/vnd.docker.distribution.manifest.list.v2+json',
        'application/vnd.oci.image.manifest.v1+json',
        'application/vnd.docker.distribution.manifest.v2+json',
      ].join(', '),
    },
  }).catch((error) => {
    fail(`Could not reach ${url}:\n${error.message}`);
  });

  if (!response.ok) {
    fail(`${url} answered ${response.status} ${response.statusText}.`);
  }

  const digest = response.headers.get('docker-content-digest');

  if (!DIGEST_PATTERN.test(digest ?? '')) {
    fail(`${url} returned no usable Docker-Content-Digest (got ${JSON.stringify(digest)}).`);
  }

  return digest;
}

/* Pinned, not inferred from the host.

   MCR publishes this image for both arm64 and amd64, and Docker on an Apple
   Silicon Mac will happily pick the arm64 one. GitHub's ubuntu-latest runners
   are amd64. Letting each side run its native architecture puts Skia and font
   rasterisation on different code paths, which reintroduces exactly the
   cross-machine drift the container exists to remove — while looking, from the
   image tag alone, as though it had been pinned. Emulation is slower here; a
   silently divergent baseline is worse. */
const PLATFORM = 'linux/amd64';

/* Named so they are easy to find and drop by hand. `--fresh` removes them.
   The work volume is what makes repeat runs bearable: node_modules survives,
   so pnpm install is near-instant after the first run. */
const WORK_VOLUME = 'ds-visual-work';
const STORE_VOLUME = 'ds-visual-pnpm-store';
const CACHE_VOLUME = 'ds-visual-cache';

const SCREENSHOTS = 'tests/visual/__screenshots__';
const REPORT = 'playwright-report';

/* Where Playwright writes the -actual/-expected/-diff images for a failed
   comparison. Mounted out because a failure that leaves no artifact on the host
   is a failure you can only theorise about — which is exactly how the first
   round of debugging here was wasted. */
const RESULTS = 'test-results';

/* Rebuilds the working copy from the read-only source mount, then installs and
   runs. The tar pair is a copy with excludes — node_modules is the important
   one, since a macOS arm64 tree is useless to a linux amd64 container.

   Build outputs are excluded too. Steps 4 and 6 decide whether the Storybook
   and Next builds happen inside the container or get mounted in; until then
   nothing here needs them. */
const CONTAINER_SCRIPT = `
set -euo pipefail

tar -C /src -cf - \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.nx \
  --exclude=.next \
  --exclude=storybook-static \
  --exclude=playwright-report \
  --exclude=test-results \
  --exclude=__screenshots__ \
  . | tar -C /work -xf -

cd /work

corepack enable
corepack prepare --activate

pnpm install --frozen-lockfile --store-dir /pnpm-store

# Two commands rather than one 'pnpm run test:visual', which swallows the
# flags: pnpm does not forward "$@" through to the underlying binary
# reliably, so --workers and --update-snapshots were silently dropped.
# Calling the build script by name keeps it defined in one place, and the
# test binary is invoked directly so its arguments arrive intact.
pnpm run pretest:visual

exec pnpm exec playwright test "$@"
`;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { stdio: 'inherit', ...options });
}

const args = process.argv.slice(2);

/* Deliberately ahead of pinnedImage(): refreshing the lockfile is the one thing
   that has to work while the lockfile is stale. */
if (args.includes('--update-digest')) {
  const tag = imageTag();
  const digest = await fetchDigest(tag);

  writeFileSync(
    DIGEST_LOCK,
    `${JSON.stringify({ refreshWith: REFRESH_COMMAND, tag, digest }, null, 2)}\n`,
  );

  process.stdout.write(`${tag}@${digest}\n`);
  process.exit(0);
}

const IMAGE = pinnedImage();

if (args.includes('--print-image')) {
  /* For the CI workflow, which needs the ref before any step has run. */
  process.stdout.write(`${IMAGE}\n`);
  process.exit(0);
}

const fresh = args.includes('--fresh');
const passthrough = args.filter((arg) => arg !== '--fresh');

/* Serial by default, because this container is emulated on an arm64 host and
   Playwright's own default (roughly half the host's cores) puts four Chromium
   instances in an 8GB VM — which OOMs the container mid-run, surfacing as a
   bare `unexpected EOF` from the daemon rather than a test failure.

   CI is unaffected: it runs this image natively on amd64 and does not go
   through this script. Worth revisiting once step 5 shows how much headroom a
   real sweep actually has; pass --workers=N to override. */
const playwrightArgs = passthrough.some((arg) => arg.startsWith('--workers'))
  ? passthrough
  : ['--workers=1', ...passthrough];

const probe = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'pipe' });

if (probe.error?.code === 'ENOENT') {
  fail(
    'Docker is not installed, and visual baselines are only valid from the pinned container.\n' +
      'Install Docker Desktop, or run the suite in CI instead.',
  );
}

if (probe.status !== 0) {
  fail(
    'The Docker daemon is not reachable — start Docker Desktop and try again.\n' +
      `Wanted image: ${IMAGE} (${PLATFORM})\n\n` +
      `${probe.stderr?.toString().trim() ?? ''}`,
  );
}

if (fresh) {
  /* Volume removal is best-effort: a volume that was never created is not an
     error worth stopping for. */
  run('docker', ['volume', 'rm', '-f', WORK_VOLUME, STORE_VOLUME, CACHE_VOLUME], {
    stdio: 'ignore',
  });
}

/* Created here rather than by Docker, which would make them root-owned. */
for (const path of [SCREENSHOTS, REPORT, RESULTS]) {
  mkdirSync(join(root, path), { recursive: true });
}

const result = run('docker', [
  'run',
  '--rm',
  '--init',
  '--platform',
  PLATFORM,
  /* Chromium exhausts Docker's default 64MB /dev/shm and crashes outright on
     large pages — which the full-page docs captures in step 6 certainly are. */
  '--shm-size=1g',
  '-v',
  `${root}:/src:ro`,
  '-v',
  `${WORK_VOLUME}:/work`,
  '-v',
  `${STORE_VOLUME}:/pnpm-store`,
  '-v',
  `${CACHE_VOLUME}:/root/.cache`,
  /* Layered over the work volume so updated baselines and the report land in
     the working tree directly. */
  '-v',
  `${join(root, SCREENSHOTS)}:/work/${SCREENSHOTS}`,
  '-v',
  `${join(root, REPORT)}:/work/${REPORT}`,
  '-w',
  '/work',
  /* Unlocks baseline updates. playwright.config.ts refuses to write baselines
     without it, so the only way to produce one is through this script. */
  '-e',
  'DS_VISUAL_CONTAINER=1',
  /* The root `prepare` script runs husky, and .git is deliberately not copied
     in. Husky honours this to skip itself; without it the install can fail on
     a missing repo, in a container that has no use for hooks anyway. */
  '-e',
  'HUSKY=0',
  /* The Storybook build phones home otherwise. This container should reach the
     network for nothing but the image itself — a telemetry call is latency and
     one more way for a baseline run to fail, for no benefit here. */
  '-e',
  'STORYBOOK_DISABLE_TELEMETRY=1',
  ...(process.env.CI ? ['-e', 'CI'] : []),
  IMAGE,
  'bash',
  '-c',
  CONTAINER_SCRIPT,
  'visual-container',
  ...playwrightArgs,
]);

process.exit(result.status ?? 1);
