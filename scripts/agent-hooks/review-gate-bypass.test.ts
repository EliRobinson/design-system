// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ADMIN_REASON, REST_MERGE_REASON, findBypass } from './review-gate-bypass.mjs';
import { GH } from './review-gate-fixtures';

// Every command is built from GH so no test file holds a literal gh command.
// `{gh}` in a case stands for it.
const cmd = (script: string) => script.replaceAll('{gh}', GH);
const reason = (script: string) => findBypass(cmd(script));

const ASK_ELI = 'stop and ask Eli';
const FLAGS_FIRST = 'flags come before the subcommand';
const ACTION_FIRST = 'right after `gh pr`';
const UNREAD = 'it may become a flag';

describe('findBypass: refuses --admin in every form', () => {
  it.each([
    '{gh} pr merge 5 --admin',
    '{gh} pr merge --admin 5',
    '{gh} pr merge 5 --squash --admin --match-head-commit abc123',
    '{gh} pr merge 5 --admin=true',
    '{gh} pr merge 5 --admin=1',
    '{gh} pr merge 5 --admin=false',
    '{gh} pr merge 5 --admin=$X',
    '{gh} pr --repo o/r merge --admin 5',
    '{gh} pr -R o/r merge 5 --admin',
    '{gh} pr merge 5 -sd --admin',
    '{gh} pr merge 5 -R other/repo --admin',
    '{gh} pr merge https://github.com/other/repo/pull/5 --admin',
    'timeout 60 {gh} pr merge 5 --admin',
    'git fetch && \\\n  {gh} pr merge 5 --rebase --admin',
    "eval '{gh} pr merge 5 --admin'",
    'eval "{gh} pr merge 5 --admin"',
    "bash -c '{gh} pr merge 5 --admin'",
    "sh -euo pipefail -c '{gh} pr merge 5 --squash --admin'",
    'echo "$({gh} pr merge 5 --admin)"',
    '{gh} pr merge 5 --admin --help=false',
    '{gh} pr merge 5 --admin -h=false',
  ])('%s', (script) => {
    expect(reason(script)).toBe(ADMIN_REASON);
  });

  it.each([
    "echo '{gh} pr merge 5 --admin' | bash",
    "bash <<< '{gh} pr merge 5 --admin'",
    'bash <<EOF\n{gh} pr merge 5 --admin\nEOF',
    'X=\'{gh} pr merge 5 --admin\'; eval "$X"',
    'python3 -c "import os; os.system(\'{gh} pr merge 5 --admin\')"',
    "python3 -c \"import subprocess; subprocess.run(['{gh}','pr','merge','5','--admin'])\"",
    "alias m='{gh} pr merge 5 --admin'",
    "{gh} alias set m 'pr merge 5 --admin'",
    'find . -maxdepth 0 -exec {gh} pr merge 5 --admin \\;',
    'pnpm exec {gh} pr merge 5 --admin',
    'script -q /dev/null {gh} pr merge 5 --admin',
    "git -c alias.x='!{gh} pr merge 5 --admin' x",
  ])('through another program: %s', (script) => {
    expect(reason(script)).toBe(`${ADMIN_REASON} Run gh directly, not through another program.`);
  });

  it.each([ADMIN_REASON, REST_MERGE_REASON])('tells the agent to stop and ask Eli: %s', (text) => {
    expect(text).toContain(ASK_ELI);
  });
});

describe('findBypass: refuses a REST merge', () => {
  it.each([
    '{gh} api -X PUT repos/o/r/pulls/5/merge',
    '{gh} api --method=PUT repos/o/r/pulls/5/merge -f merge_method=squash',
    '{gh} api --method PUT repos/other/repo/pulls/5/merge',
    '{gh} api repos/o/r/pulls/5/merge -f merge_method=squash',
    '{gh} api -X GET -X PUT repos/o/r/pulls/5/merge',
    "{gh} api -X PUT 'repos/o/r/pulls/5/merge?x=1'",
    '{gh} api -X PUT repos/o/r/pulls/5/x/../merge',
    '{gh} api -X PUT repos/o/r/pulls/5/%6Derge',
    '{gh} api -X PUT https://api.github.com/repos/o/r/pulls/5/merge',
    '{gh} api -X PUT "repos/o/r/pulls/$N/merge"',
    '{gh} api -iXPUT repos/o/r/pulls/5/merge',
    '{gh} api -iX PUT repos/o/r/pulls/5/merge',
    '{gh} api -X=PUT repos/o/r/pulls/5/merge',
    '{gh} api -iX=PUT repos/o/r/pulls/5/merge',
    '{gh} api -if merge_method=squash repos/o/r/pulls/5/merge -X PUT',
    '{gh} api -iH a:b repos/o/r/pulls/5/merge -X PUT',
    '{gh} api -f=merge_method=squash repos/o/r/pulls/5/merge',
    '{gh} api -F=merge_method=squash repos/o/r/pulls/5/merge',
    'curl -X PUT -H "Authorization: Bearer $T" https://api.github.com/repos/o/r/pulls/5/merge',
    'curl -sXPUT https://api.github.com/repos/o/r/pulls/5/merge',
    "curl -d '{}' https://api.github.com/repos/o/r/pulls/5/merge",
    'curl -X GET -X PUT https://api.github.com/repos/o/r/pulls/5/merge',
    'curl --request=PUT --url=https://api.github.com/repos/o/r/pulls/5/merge',
    'wget --method=PUT https://api.github.com/repos/o/r/pulls/5/merge',
    'http PUT https://api.github.com/repos/o/r/pulls/5/merge',
    'http https://api.github.com/repos/o/r/pulls/5/merge merge_method=squash',
    '{gh} api -X PUT repos/o/r/pulls/5/merge --help=false',
    'curl {-XPUT,https://api.github.com/repos/o/r/pulls/5/merge}',
  ])('%s', (script) => {
    expect(reason(script)).toBe(REST_MERGE_REASON);
  });

  it('refuses one named through another program', () => {
    const script =
      'python3 -c "import requests; requests.put(\'https://api.github.com/repos/o/r/pulls/5/merge\')"';
    expect(reason(script)).toContain(REST_MERGE_REASON);
  });
});

describe('findBypass: refuses merge words it cannot read', () => {
  it.each([
    ['{gh} pr merge 5 $FLAGS', UNREAD],
    ['{gh} pr merge 5 --squash "$F"', UNREAD],
    ['{gh} pr merge "$N" --rebase', UNREAD],
    ['{gh} pr merge 5 -R other/repo "$F"', UNREAD],
    ['{gh} pr merge 5 --body $B', UNREAD],
    ['{gh} pr merge 5 -t $(echo x) --squash', UNREAD],
    ['{gh} pr merge 5 --match-head-commit $S', UNREAD],
    ['{gh} pr merge 5 --body "$@"', UNREAD],
    ['{gh} pr merge 5 -t "${a[@]}"', UNREAD],
    ['Y=\'x --admin\'; {gh} pr merge 5 --squash -t "${=Y}"', UNREAD],
    ['{gh} pr merge 5 -t "${(f)X}"', UNREAD],
    ['{gh} pr merge 5 -t "$a[@]"', UNREAD],
    ['{gh} pr merge 5 -- $X', UNREAD],
    ['{gh} pr -R $R', UNREAD],
    ['A=merge; {gh} pr $A 5', UNREAD],
    ["{gh} pr $'merge' 5", UNREAD],
    ["{gh} $'pr' merge 5", UNREAD],
    ['{gh} pr merge 5 --{admin,rebase}', UNREAD],
    ['{gh} pr merge 5 --{admin..admin}', UNREAD],
    ['{gh} api {-XPUT,repos/o/r/pulls/5/merge}', UNREAD],
    ['{gh} --admin=true pr merge 5', FLAGS_FIRST],
    ['{gh} -R o/r pr merge 5 --admin', FLAGS_FIRST],
    ['{gh} --repo=o/r pr merge 5 --admin', FLAGS_FIRST],
    ['{gh} -X PUT api repos/o/r/pulls/5/merge', FLAGS_FIRST],
    ['{gh} -f merge_method=squash api repos/o/r/pulls/5/merge', FLAGS_FIRST],
    ['X=pr; {gh} -R o/r $X merge 5 --admin', FLAGS_FIRST],
    ['{gh} -R o/r "$X" merge 5 --admin', FLAGS_FIRST],
    ['{gh} pr --body x merge 5 --admin', ACTION_FIRST],
    ['{gh} pr -t x merge 5 --admin', ACTION_FIRST],
    ['{gh} pr -t x $A 5 --admin', ACTION_FIRST],
    ['{gh} pr -t x "$A" 5 --admin', ACTION_FIRST],
    ['{gh} pr -t x create', ACTION_FIRST],
    ['{gh} api repos/o/r/pulls/5/merge $X', UNREAD],
    ['{gh} api repos/o/r/pulls/5/merge -H $H', UNREAD],
    ['{gh} api repos/o/r/pulls/5/merge --header=$H', UNREAD],
    ['{gh} api "$E" repos/o/r/pulls/5/merge', UNREAD],
    ['{gh} api repos/o/r/pulls/$N', UNREAD],
    ['E=repos/o/r/pulls/5/merge; {gh} api -X PUT "$E"', 'which endpoint'],
    ['{gh} api --method PATCH "repos/o/r/pulls/$N"', 'which endpoint'],
  ])('%s', (script, says) => {
    expect(reason(script)).toContain(says);
  });

  it.each([
    ['{gh} pr merge 5 --body $B', true],
    ['{gh} pr merge 5 --body "$@"', false],
    ['{gh} pr merge 5 --body "${a[@]}"', false],
  ])('suggests double quotes only when they would help: %s', (script, suggests) => {
    expect(reason(script)?.includes('double quotes')).toBe(suggests);
  });
});

describe('findBypass: lets plain merges, reads and text through', () => {
  it.each([
    '{gh} pr merge 5 --rebase',
    '{gh} pr merge 5 --squash --delete-branch --match-head-commit abc123',
    '{gh} pr merge 5 --squash --subject "$T" --body "$B" -R o/r',
    '{gh} pr merge 5 -t "$T" -b"$B"',
    '{gh} pr merge --admin --help',
    '{gh} pr merge -h --admin',
    '{gh} pr -R o/r merge 5 --rebase',
    '{gh} pr view 5 --json mergeStateStatus',
    '{gh} pr -R "$R" view 5',
    '{gh} pr create -F body.md',
    '{gh} --version',
    '{gh} -R "$REPO" issue list',
    '{gh} api repos/o/r/pulls/5/merge',
    '{gh} api -X GET repos/o/r/pulls/5/merge',
    '{gh} api "repos/o/r/pulls/$N"',
    '{gh} api -H"$H" repos/o/r',
    '{gh} api repos/{owner}/{repo}/pulls',
    '{gh} api repos/o/r/issues -f title="$T"',
    '{gh} api -X POST "repos/o/r/issues/$N/comments" -f body=x',
    "{gh} api graphql -f query='query { viewer { login } }'",
    'curl -s -H "Authorization: Bearer $T" https://api.github.com/repos/o/r/pulls/5/merge',
    'curl -sI https://api.github.com/repos/o/r/pulls/5/merge',
    'curl -XGET https://api.github.com/repos/o/r/pulls/5/merge',
    'curl -X PUT https://example.com/upload',
    'http GET https://api.github.com/repos/o/r/pulls/5/merge',
    'echo {gh} pr merge 5 --admin',
    "git commit -m 'refuse {gh} pr merge --admin'",
    "{gh} issue create --title '{gh} pr merge --admin is refused' --body x",
    "printf '%s\\n' '{gh} pr merge --admin' > notes.md",
    'python3 -c "print(1)"',
    'bash script.sh',
    '"$PNPM" test',
  ])('%s', (script) => {
    expect(reason(script)).toBeNull();
  });
});

// The two gate checks once read gh flags with two readers that disagreed on
// these forms. Each now reads them as gh does: gh shows help and runs
// nothing.
describe('findBypass: reads help as gh does', () => {
  it.each([
    '{gh} pr merge 5 --admin -dh',
    '{gh} pr merge 5 --admin --help=t',
    '{gh} pr merge 5 --admin -h=1',
    '{gh} api -X PUT repos/o/r/pulls/5/merge -h=true',
  ])('%s', (script) => {
    expect(reason(script)).toBeNull();
  });

  // `-h"$X"` with X='=false' runs as `-h=false`: help off.
  it.each([
    ['{gh} pr merge 5 --admin -h"$X"', ADMIN_REASON],
    ['{gh} pr merge 5 --admin -dh$X', ADMIN_REASON],
  ])('does not take a run-time short help as help: %s', (script, says) => {
    expect(reason(script)).toBe(says);
  });

  it('does not take a run-time short help on gh api as help', () => {
    expect(reason('{gh} api -X PUT repos/o/r/pulls/5/merge -h"$X"')).toContain(UNREAD);
  });
});
