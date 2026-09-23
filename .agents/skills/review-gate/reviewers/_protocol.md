# Reviewer protocol

Every reviewer in the pre-PR review gate follows this.

## How to work

1. Get the branch diff: `git fetch -q origin main && git diff origin/main...HEAD`. Read the changed files in full where the diff is not enough.
2. Do not edit, write, stage, or commit anything. You report; the author fixes.
3. Check every finding against the code before you report it. Drop anything you cannot point to.

## Report

Return a list. For each finding give:

- `file:line`
- severity: `blocker`, `should-fix`, or `nit`
- what is wrong, in one or two sentences
- the fix you suggest

If you find nothing, say `No findings` and name what you checked.
