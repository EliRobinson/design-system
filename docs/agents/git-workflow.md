# Git workflow

Always use conventional commit messages.

## Screenshots for front-end changes

Any PR that changes front-end code (components, layout, styling, tokens that affect rendered output) must include before-and-after screenshots in the PR description. Take the "before" screenshot on the unmodified code, make the change, then take the "after" screenshot of the same view. This gives reviewers a visual diff alongside the code diff for stronger UI/UX review — don't rely on a description of the change instead.

### Link them by pinned raw URL, not by relative path

Every PR that has ever attached a screenshot got the link form wrong, each in a different way. Two were broken on arrival; the other two rendered fine and were quietly depending on a ref that would not last. All four are listed because the failure mode is what makes the rule stick:

| PR   | form used                           | what happened                                         |
| ---- | ----------------------------------- | ----------------------------------------------------- |
| #88  | relative path                       | never rendered, from the day it was opened            |
| #73  | absolute URL on the **branch name** | 404 the moment the branch was deleted on merge        |
| #67  | absolute URL on **`main`**          | renders — until the file is moved, renamed or deleted |
| #107 | absolute URL on the **branch SHA**  | renders, but the SHA was orphaned by squash-merge     |

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

### After merge, repoint to the squash commit

**This repo squash-merges, which orphans every commit on the branch** — including the one the screenshots are pinned to. So the SHA you had to use when opening the PR is, by definition, not the SHA the record should keep.

GitHub still serves blobs from unreachable commits, so nothing visibly breaks the moment it merges (verified on #107 after its branch commit was orphaned). But it is unreachable from any ref, nothing guarantees it stays served, and `git show <sha>` fails for anyone who fetches the repo fresh. Repoint the body once, right after merging:

```bash
gh pr view <pr> --json mergeCommit -q .mergeCommit.oid   # the squash commit, on main
```

Swap that SHA into the body's image URLs and `gh pr edit <pr> --body-file …`. Two SHAs total: the branch one to open with, the squash one to leave behind.

A human opening the PR in a browser can skip all of this by dragging the PNGs into the description box, which uploads them to GitHub's `user-attachments` CDN — tied to no commit, so there is nothing to repoint and nothing enters the repo. That is the nicer result, but it cannot be scripted, so anything running headless uses the committed-asset path above.

### Capturing the pair

Both shots must differ by the change and nothing else. A stray hover state, a different viewport, or a rebuilt page with unrelated drift in it turns a visual diff into a puzzle.

For a CSS-only change the cheapest way to guarantee that is to capture both from **one** build, toggling the single declaration under test in the live stylesheet between shots rather than rebuilding between them — walk `document.styleSheets`, find the rule by `selectorText`, and `removeProperty` / `setProperty` around each `page.screenshot()`. A throwaway Playwright config pointed at the docs build does this in a few seconds; delete it once the PNGs exist, so it never becomes a second visual suite that has to be maintained (and never mints baselines in `tests/visual/`). PR #107 is a worked example.

Assert the end state inside the capture script too — that the element really is centred, really is the new colour. A silently broken capture is indistinguishable from a correct one until a human opens the PR, and by then it is being read as proof.
