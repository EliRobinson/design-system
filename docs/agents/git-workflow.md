# Git workflow

Always use conventional commit messages.

## This repo rebase-merges

Squash and merge commits are both disabled; `gh pr merge --squash` fails with
`Squash merges are not allowed on this repository`. Use `--rebase`.

Two consequences, and the second is the one that changes how you write a branch:

- **A merged branch is still never an ancestor of `main`.** Rebasing rewrites
  every commit, so the SHAs you pushed are not the SHAs that land. Check PR
  state — `gh pr view <n> --json state` — never `git merge-base --is-ancestor`,
  which reports merged branches as unmerged. This was equally true under
  squash; only the mechanism changed.
- **Every commit on the branch lands on `main` individually.** Nothing is
  folded away, so an intermediate commit is permanent history rather than a
  private working step. Keep the branch to commits you would want in the log.
  That includes the baseline-accept commit CI pushes for you when you apply
  `visual-accept` — it lands beside your change rather than being absorbed
  into it.

## Worktrees share one Nx cache, so `nx reset` is repo-wide

Run from a worktree — `.claude/worktrees/<branch>` — `nx reset` deletes the **main
checkout's** `.nx/cache`, not the worktree's. It also deletes the main checkout's
`.nx/workspace-data`, where the cache's index lives. It is the least visible of the
worktree traps because clearing a cache produces no error and no output naming a
path: the command prints `Successfully reset the Nx workspace` either way.

The mechanism, read in `node_modules/nx/dist/src/utils/cache-directory.js` at Nx
22.7.0, is deliberate and documented in Nx's own comment — "In a git worktree this
resolves to the main repo's cache dir so all worktrees share the same cache". The
exported `cacheDir` is `sharedCacheDirectory(workspaceRoot)`, which asks the native
`getMainWorktreeRoot()` for the main repo root and resolves the cache against that
instead of the current root. `reset.js`'s `cleanupCacheEntries` then `rmSync`s
exactly that path, and its `cleanupWorkspaceData` goes one step further, deleting
the main repo's `.nx/workspace-data` by name.

Before [#139](https://github.com/EliRobinson/design-system/pull/139) every target
had `cache: undefined`, so `.nx/cache` held nothing anyone depended on and clearing
it cost nothing. Now `build`, `test` and `lint` are all `cache: true` and CI
restores `.nx/cache` across runs, so the local cache is an accumulation across every
branch in flight — 2.2G when this was filed. One reset from one worktree buys a cold
rebuild in every worktree, not just the one that ran it.

**No workflow runs `nx reset`** (grepped across `.github/` for #150). Keep it that
way: on a runner it would delete the `.nx/cache` the job had just restored, silently
undoing #139 for that job.

### Measure a cold build with `--skip-nx-cache`

That is what `nx reset` was being reached for, and `--skip-nx-cache` gives it scoped
to one invocation, touching no shared state. Make it the default habit:

```bash
pnpm nx run-many -t build,test --skip-nx-cache
```

Twelve of the last hundred PR bodies already record their verification this way —
[#165](https://github.com/EliRobinson/design-system/pull/165) is the clearest:
"Five cold `nx run-many -t build,test --skip-nx-cache` runs, deleting
`packages/*/dist` before each."

### Do not try to isolate the cache with `NX_CACHE_DIRECTORY`

Nothing in this repo sets it, and nothing should. Verified against Nx 22.7.0's
source rather than assumed, because the honest answer is more specific than "it
doesn't work":

- **An absolute value does fully redirect the cache directory.** `NX_CACHE_DIRECTORY`
  is checked before every other source in `cacheDirectory()`, so a worktree can point
  `cacheDir` anywhere. The trap below is not that the redirect fails.
- **A relative value redirects into the main checkout.** Relative paths are resolved
  against the root `sharedCacheDirectory` already picked — the main repo's. Setting
  `NX_CACHE_DIRECTORY=.nx/cache-worktree` in a worktree resolves to
  `<main checkout>/.nx/cache-worktree`: still shared by every worktree, just at a new
  path, and no longer the one CI caches.
- **Redirecting only the cache directory is a partial redirect, which is worse than
  none.** The cache is a directory of outputs _plus_ a SQLite index at
  `.nx/workspace-data/nx.db`, and the two are resolved independently —
  `utils/db-connection.js` runs its own `getMainWorktreeRoot()` lookup, so the DB
  stays in the main checkout. A worktree with only `NX_CACHE_DIRECTORY` set writes
  outputs locally while recording them in the main checkout's shared index, and
  `nx reset` there still deletes that index. Nx names the resulting state itself, in
  `tasks-runner/cache.js`: "Nx can only restore artifacts it has metadata about" —
  and that warning is gated on `isCI()`, so on a laptop the mostly-isolated cache
  just quietly misses.

Full isolation needs `NX_CACHE_DIRECTORY` **and** `NX_WORKSPACE_DATA_DIRECTORY`, both
absolute, per worktree. It works, and it is still not worth doing: it gives every
worktree its own cold cache, which is precisely the cross-branch sharing that makes
the 2.2G cache worth having. Leave both unset and reach for `--skip-nx-cache`.

## Screenshots for front-end changes

Any PR that changes front-end code (components, layout, styling, tokens that affect rendered output) must include before-and-after screenshots in the PR description. Take the "before" screenshot on the unmodified code, make the change, then take the "after" screenshot of the same view. This gives reviewers a visual diff alongside the code diff for stronger UI/UX review — don't rely on a description of the change instead.

### Link them by pinned raw URL, not by relative path

Every PR that has ever attached a screenshot got the link form wrong, each in a different way. Two were broken on arrival; the other two rendered fine and were quietly depending on a ref that would not last. All four are listed because the failure mode is what makes the rule stick:

| PR   | form used                           | what happened                                         |
| ---- | ----------------------------------- | ----------------------------------------------------- |
| #88  | relative path                       | never rendered, from the day it was opened            |
| #73  | absolute URL on the **branch name** | 404 the moment the branch was deleted on merge        |
| #67  | absolute URL on **`main`**          | renders — until the file is moved, renamed or deleted |
| #107 | absolute URL on the **branch SHA**  | renders, but the SHA was orphaned when the PR merged  |

All four have since been repointed at a commit reachable from `main`, so don't read them as live examples of the breakage — read the table.

**GitHub does not resolve relative image paths in a pull request body.** It leaves the `src` exactly as written, and the browser then resolves it against the PR's own URL — `docs/pr-assets/x.png` on `/pull/88` becomes `/pull/docs/pr-assets/x.png`, which redirects to a login page and renders as a broken image. This is not a permissions problem and it does not come good later; the repo is public and the file is committed. It simply never worked.

Commit the images, then reference them by **absolute raw URL pinned to the commit SHA**:

```markdown
![Dialog centred in the viewport](https://raw.githubusercontent.com/EliRobinson/design-system/<sha>/docs/pr-assets/<slug>/dialog-after.png)
```

Pin the **SHA, not the branch name**. A `.../design-system/<branch>/...` URL works right up until the branch is deleted on merge, and then every screenshot in the PR history breaks at once — which is the moment the record becomes worth reading.

The order matters, because the SHA has to exist before you can link to it:

```bash
git add docs/pr-assets/<slug> && git commit -m "docs(pr-assets): before/after screenshots for #<issue>" && git push && git rev-parse HEAD
```

Then write the body with that SHA and open the PR. Verify the images actually resolve rather than assuming — a broken screenshot in a PR body looks identical to no screenshot at all until someone opens the page:

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://raw.githubusercontent.com/EliRobinson/design-system/<sha>/docs/pr-assets/<slug>/dialog-after.png
```

Check the content type, not just the status. A 404 from `github.com` redirects to a login page and answers `200 text/html`; only `image/png` means the link is good.

### After merge, repoint to the commit that landed

**Merging orphans every commit on the branch** — including the one the screenshots are pinned to. Rebasing rewrites each commit onto `main`, so what you pushed and what landed are different objects, and the SHA you had to use when opening the PR is, by definition, not the SHA the record should keep. (This was true under squash for a different reason, which is why the procedure below did not change when the merge method did.)

GitHub still serves blobs from unreachable commits, so nothing visibly breaks the moment it merges (verified on #107 after its branch commit was orphaned). But it is unreachable from any ref, nothing guarantees it stays served, and `git show <sha>` fails for anyone who fetches the repo fresh. Repoint the body once, right after merging:

```bash
gh pr view <pr> --json mergeCommit -q .mergeCommit.oid   # the tip that landed, on main
```

For a rebase merge that is the **tip of the landed sequence**, not a single combined commit — verified on #184, where the branch's two commits landed as `ce0a782` and `7417ed8` and `mergeCommit` returned the latter. The tip is still the right SHA to pin to even when the assets were committed earlier in the branch: a file added by any commit is present in every commit after it, so the tip carries every PNG the branch introduced.

Swap that SHA into the body's image URLs and `gh pr edit <pr> --body-file …`. Two SHAs total: the branch one to open with, the landed one to leave behind.

A human opening the PR in a browser can skip all of this by dragging the PNGs into the description box, which uploads them to GitHub's `user-attachments` CDN — tied to no commit, so there is nothing to repoint and nothing enters the repo. That is the nicer result, but it cannot be scripted, so anything running headless uses the committed-asset path above.

### Capturing the pair

Both shots must differ by the change and nothing else. A stray hover state, a different viewport, or a rebuilt page with unrelated drift in it turns a visual diff into a puzzle.

For a CSS-only change the cheapest way to guarantee that is to capture both from **one** build, toggling the single declaration under test in the live stylesheet between shots rather than rebuilding between them — walk `document.styleSheets`, find the rule by `selectorText`, and `removeProperty` / `setProperty` around each `page.screenshot()`. A throwaway Playwright config pointed at the docs build does this in a few seconds; delete it once the PNGs exist, so it never becomes a second visual suite that has to be maintained (and never mints baselines in `tests/visual/`). PR #107 is a worked example.

Assert the end state inside the capture script too — that the element really is centred, really is the new colour. A silently broken capture is indistinguishable from a correct one until a human opens the PR, and by then it is being read as proof.
