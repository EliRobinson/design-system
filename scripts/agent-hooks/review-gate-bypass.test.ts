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
const UNREAD_URL = 'Write the URL out in full';
const MERGE_URL = 'https://api.github.com/repos/o/r/pulls/5/merge';
const UNREAD_COMMAND = 'it may become `gh pr create` or `gh pr merge --admin`';

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
    '{gh} api -X PUT "repos/$R/pulls/5/merge"',
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
    `curl -T f ${MERGE_URL}`,
    `curl --upload-file f ${MERGE_URL}`,
    `curl -4XPUT ${MERGE_URL}`,
    `http --timeout 5 PUT ${MERGE_URL}`,
    `xh -S PUT ${MERGE_URL}`,
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
    ['{gh} pr -R $R', UNREAD_COMMAND],
    ['A=merge; {gh} pr $A 5', UNREAD_COMMAND],
    ["{gh} pr $'merge' 5", UNREAD_COMMAND],
    ["{gh} $'pr' merge 5", UNREAD_COMMAND],
    ['{gh} pr merge 5 --{admin,rebase}', UNREAD],
    ['{gh} pr merge 5 --{admin..admin}', UNREAD],
    ['{gh} api {-XPUT,repos/o/r/pulls/5/merge}', UNREAD],
    ['{gh} pr merge 5 --admi[n]', UNREAD],
    ['{gh} pr merge 5 --admin*', UNREAD],
    ['{gh} pr merge 5 --admi[" "n]', UNREAD],
    ['{gh} pr merge 5 --admi[n\\ ]', UNREAD],
    ['{gh} pr merge 5 --admi(n|x)', UNREAD],
    ['{gh} pr merge 5 --admi(n) --squash', UNREAD],
    ['{gh} pr merge 5 --admi@(n)', UNREAD],
    ['{gh} pr merge 5 --admi+(n)', UNREAD],
    ['{gh} pr merge 5 --admi*(n)', UNREAD],
    ['{gh} pr merge 5 --admi?(n)', UNREAD],
    ['{gh} pr merge 5 --admi!(x)', UNREAD],
    ['{gh} pr merg(e) 5 --admin', UNREAD_COMMAND],
    ['time({gh} pr merge 5 $F)', UNREAD],
    ['coproc({gh} pr merge 5 $F)', UNREAD],
    ['time({gh} pr merge 5 --admi[n])', UNREAD],
    ['curl -X PUT https://api.github.com/repos/o/r/pulls/5/merg[e]', UNREAD_URL],
    ['curl -X PUT https://api.github.com/repos/o/r/pulls/5/m*', UNREAD_URL],
    ['curl -X PUT https://api.github.com/repos/o/r/pulls/5/merg@(e)', UNREAD_URL],
    ['curl -X PUT https://api.github.com/repos/o/r/pull?/5/merge', UNREAD_URL],
    ['curl -X PUT https://api.github.com/repos/o/r/pul[l]s/5/merge', UNREAD_URL],
    ['curl -X PUT https://api.github.com/repos/o/r/*/*/*', UNREAD_URL],
    ['curl -X PUT https://api.github.com/repos/o/r/pulls/5/$X', UNREAD_URL],
    ['curl -d x https://api.github.com/repos/o/r/pulls/5/merg[e]', UNREAD_URL],
    ['http PUT api.github.com/repos/o/r/pulls/5/m*', UNREAD_URL],
    ['curl -X PUT "https://api.github.com/repos/o/r/$P"', UNREAD_URL],
    ['curl -X PUT https://ghe.example.com/api/v3/repos/o/r/pulls/5/m*', UNREAD_URL],
    ['curl -X "$M" https://api.github.com/repos/o/r/pulls/5/merge', REST_MERGE_REASON],
    ['http "$M" https://api.github.com/repos/o/r/pulls/5/merge', REST_MERGE_REASON],
    ['http "$M" "https://api.github.com/repos/$R"', UNREAD_URL],
    ['curl -X PUT https://api.github.c[o]m/repos/o/r/pulls/5/merge', REST_MERGE_REASON],
    ['curl -X PUT https://api.github.c[o]m/repos/o/r/pulls/5/m*', UNREAD_URL],
    ['curl -X PUT https://$H/api/v3/$P', UNREAD_URL],
    ['curl -X PUT "https://ghe.example.com/API/V3/$P"', UNREAD_URL],
    ['curl -X PUT "https://api.$D/repos/o/r"', UNREAD_URL],
    ['curl -X PUT -H x "https://$H/api/v3"', UNREAD_URL],
    // A body or flag value that names the API is read too, so a missing
    // option cannot hide a URL; this one only adds a refusal.
    [
      'curl -X POST https://api.github.com/repos/o/r/issues -d "{\\"u\\":\\"https://api.github.com/x\\",\\"a\\":$x}"',
      UNREAD_URL,
    ],
    [
      'http POST https://api.github.com/repos/o/r/issues body="see https://api.github.com/$x"',
      UNREAD_URL,
    ],
    ['{gh} pr merge 5 (--admin|zz)', UNREAD],
    ['{gh} (pr|zz) create', UNREAD_COMMAND],
    ['{gh} pr merge 5 *', UNREAD],
    ['{gh} pr merge 5 -t fix?', UNREAD],
    ['{gh} api -X PUT repos/o/r/pulls/5/merg[e]', UNREAD],
    ['{gh} api -X PUT repos/o/r/pulls/5/m*', UNREAD],
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
  ])('%s', (script, says) => {
    expect(reason(script)).toContain(says);
  });

  // zsh glob qualifiers run their e strings as shell code (#465).
  it.each([
    ['ls *(e:"{gh} pr merge 5 $F":)', UNREAD],
    ["ls *(e:'{gh} pr merge 5 $F':)", UNREAD],
    ["ls *(e['{gh} pr merge 5 $F'])", UNREAD],
    ["ls *(.oe:'{gh} pr merge 5 $F':)", UNREAD],
    ["ls (a|b)(e:'{gh} pr $A 5':)", UNREAD_COMMAND],
    ["ls *(e:'{gh} pr merge 5 --admin':)", ADMIN_REASON],
    ['ls *(e:{gh}\\ pr\\ merge\\ 5\\ --admin:)', ADMIN_REASON],
  ])('reads a glob qualifier’s e string as commands: %s', (script, says) => {
    expect(reason(script)).toContain(says);
  });

  // A `+name` qualifier, or one an expansion builds, is a command built at
  // run time, so the whole script is checked.
  it.each([
    'ls *(+fn) && echo "{gh} pr merge 5 --admin"',
    'ls *($Q) && echo "{gh} pr merge 5 --admin"',
    'ls *(e:"$X":) && echo "{gh} pr merge 5 --admin"',
  ])('checks the whole script after a glob qualifier it cannot read: %s', (script) => {
    expect(reason(script)).toBe(`${ADMIN_REASON} Run gh directly, not through another program.`);
  });

  it.each([
    ['{gh} pr merge 5 --body $B', true],
    ['{gh} pr merge 5 --body "$@"', false],
    ['{gh} pr merge 5 --body "${a[@]}"', false],
  ])('suggests double quotes only when they would help: %s', (script, suggests) => {
    expect(reason(script)?.includes('double quotes')).toBe(suggests);
  });
});

// #462: a gh api write whose endpoint the shell builds at run time may go to
// `repos/<o>/<r>/pulls` (a PR open) or `pulls/<N>/merge` (a merge), wherever
// in the endpoint the run-time word stands.
describe('findBypass: refuses a gh api write to a run-time endpoint', () => {
  const API_WRITE = "gh api write's endpoint";
  const apiWrite = (word: string) => `\`${word}\` in this ${API_WRITE}`;

  it.each([
    ['{gh} api -X POST "repos/$R/pulls"', apiWrite('repos/$R/pulls')],
    ['{gh} api -X POST repos/"$R"/pulls', apiWrite('repos/$R/pulls')],
    ['{gh} api --method=POST "repos/$R/pulls"', apiWrite('repos/$R/pulls')],
    ['{gh} api -X post "repos/$R/pulls"', apiWrite('repos/$R/pulls')],
    ['{gh} api "repos/$R/pulls" -f title=x', apiWrite('repos/$R/pulls')],
    ['{gh} api "repos/$R/pulls" -F title=x', apiWrite('repos/$R/pulls')],
    ['{gh} api "repos/$R/pulls" --field title=x', apiWrite('repos/$R/pulls')],
    ['{gh} api "repos/$R/pulls" --raw-field title=x', apiWrite('repos/$R/pulls')],
    ['{gh} api --input body.json "repos/$R/pulls"', apiWrite('repos/$R/pulls')],
    ['{gh} api -X POST "repos/$(echo o/r)/pulls"', apiWrite('repos/$(echo o/r)/pulls')],
    ["{gh} api -X POST $'repos/o/r/pulls'", API_WRITE],
    ['{gh} api -X PATCH "repos/o/r/pulls/$N"', apiWrite('repos/o/r/pulls/$N')],
    ['{gh} api -X DELETE "repos/$R/pulls/5"', apiWrite('repos/$R/pulls/5')],
    ['E=repos/o/r/pulls/5/merge; {gh} api -X PUT "$E"', apiWrite('$E')],
    [
      '{gh} api -X POST "repos/o/r/issues/$N/comments" -f body=x',
      apiWrite('repos/o/r/issues/$N/comments'),
    ],
    ['{gh} api -X "$M" "repos/$R/pulls"', apiWrite('repos/$R/pulls')],
    ['{gh} api "$G" -f query=x', apiWrite('$G')],
  ])('%s', (script, says) => {
    expect(reason(script)).toContain(says);
  });

  it('says it may open or merge a PR', () => {
    expect(reason('{gh} api -X POST "repos/$R/pulls"')).toContain(
      'it may open or merge a PR. Write the endpoint out in full.',
    );
  });

  // An unquoted run-time endpoint may also split into a flag, so the
  // gh api call reason, checked first, refuses it.
  it.each(['{gh} api -X POST repos/$R/pulls', '{gh} api repos/$R/pulls -f title=x'])(
    'refuses an unquoted one as a word that may be a flag: %s',
    (script) => {
      expect(reason(script)).toContain(UNREAD);
    },
  );

  it.each([
    '{gh} api "repos/$R/pulls"',
    '{gh} api "repos/o/r/pulls/$N"',
    '{gh} api -X GET "repos/$R/pulls"',
    '{gh} api --method=get "repos/$R/pulls"',
    '{gh} api -X GET "repos/$R/pulls" -f state=open',
    '{gh} api -X HEAD "repos/$R/pulls"',
    '{gh} api -X POST repos/{owner}/{repo}/issues -f title=x',
  ])('lets a read or a literal endpoint through: %s', (script) => {
    expect(reason(script)).toBeNull();
  });
});

// A word the shell builds at run time where gh reads its command or the pr
// action may become `pr create` or `pr merge --admin`: the first skips the
// review, the second bypasses branch protection.
describe('findBypass: refuses a gh command or pr action it cannot read', () => {
  it.each([
    ['{gh} pr $X', UNREAD_COMMAND],
    ['{gh} pr "$X"', UNREAD_COMMAND],
    ['{gh} pr $(echo create)', UNREAD_COMMAND],
    ['{gh} pr cre*', UNREAD_COMMAND],
    ['{gh} pr -R o/r $X', UNREAD_COMMAND],
    ['{gh} pr --repo=o/r $X', UNREAD_COMMAND],
    ['{gh} $X create', UNREAD_COMMAND],
    ['{gh} p[r] create', UNREAD_COMMAND],
    ['{gh} $X', UNREAD_COMMAND],
    // #461: an unquoted -R value splits, so `X='o/r pr'` makes gh's command
    // word `pr`, or `X='o/r create'` makes the pr action `create`.
    ['{gh} -R $X create', UNREAD_COMMAND],
    ['{gh} --repo $X create -b y', UNREAD_COMMAND],
    ['{gh} -R$X create', UNREAD_COMMAND],
    ['{gh} --repo=$X create', UNREAD_COMMAND],
    ['{gh} pr -R $X view', UNREAD_COMMAND],
    ['{gh} pr --repo $X view 5', UNREAD_COMMAND],
    ['{gh} pr -R$X list', UNREAD_COMMAND],
    ['{gh} pr --repo=$X list', UNREAD_COMMAND],
    // A flag built at run time may split into `-R o/r pr`, or take the next
    // word as its value.
    ['{gh} pr -$X o/r create', UNREAD_COMMAND],
    ['{gh} pr "-$X" o/r create', UNREAD_COMMAND],
    ['{gh} pr -$X o/r view', UNREAD_COMMAND],
    ['{gh} -$X o/r pr create', UNREAD_COMMAND],
    ['{gh} -$X o/r create', UNREAD_COMMAND],
    ['{gh} "-$X" o/r create', UNREAD_COMMAND],
    // Another flag first may take the next word as its value, so the command
    // word may still be ahead of these.
    ['{gh} -t T -R $X create -b y', UNREAD_COMMAND],
    ['{gh} --title T -R $X create -b y', UNREAD_COMMAND],
    ['{gh} -t T --repo=$X create', UNREAD_COMMAND],
    ['{gh} -t T -$X create', UNREAD_COMMAND],
    ['{gh} --foo x -$X create', UNREAD_COMMAND],
  ])('%s', (script, says) => {
    expect(reason(script)).toContain(says);
  });

  it.each([
    ['{gh} -R o/r pr $X', FLAGS_FIRST],
    ['{gh} --repo o/r $X create', FLAGS_FIRST],
    ['{gh} -R "$R" pr list', FLAGS_FIRST],
  ])('reads a flag before pr or a run-time command as flags first: %s', (script, says) => {
    expect(reason(script)).toContain(says);
  });

  it.each([
    ['{gh} -R $X create', true],
    ['{gh} --repo=$X create', true],
    ['{gh} pr -R $X view', true],
    ['{gh} -$X o/r create', false],
    ['{gh} pr cre*', false],
    ['{gh} pr $X', false],
  ])('suggests double quotes only for a -R value: %s', (script, suggests) => {
    expect(reason(script)?.includes('double quotes')).toBe(suggests);
  });

  it.each([
    '{gh} pr list',
    '{gh} pr view $N',
    '{gh} pr checkout "$B"',
    '{gh} pr -R "$R" list',
    '{gh} pr --repo="$R" view 5',
    '{gh} issue create -t x -b y',
    '{gh} issue view $N',
    '{gh} -R "$REPO" issue view $N',
    '{gh} --repo="$REPO" issue list',
    '{gh} --repo=o/r issue -R $X list',
  ])('lets a literal command and action through: %s', (script) => {
    expect(reason(script)).toBeNull();
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
    '{gh} pr merge 5 --squash -t "fix?" --body \'* done\'',
    '{gh} pr merge 5 --rebase -t \\*',
    '{gh} pr list --search "is:open"',
    '{gh} api "repos/o/r/pulls?state=open"',
    'git commit -m "fix?"',
    '{gh} --version',
    '{gh} -R "$REPO" issue list',
    '{gh} api repos/o/r/pulls/5/merge',
    '{gh} api -X GET repos/o/r/pulls/5/merge',
    '{gh} api "repos/o/r/pulls/$N"',
    '{gh} api -H"$H" repos/o/r',
    '{gh} api repos/{owner}/{repo}/pulls',
    '{gh} api repos/o/r/issues -f title="$T"',
    "{gh} api graphql -f query='query { viewer { login } }'",
    'curl -s -H "Authorization: Bearer $T" https://api.github.com/repos/o/r/pulls/5/merge',
    'curl -sI https://api.github.com/repos/o/r/pulls/5/merge',
    'curl -XGET https://api.github.com/repos/o/r/pulls/5/merge',
    'curl -X PUT https://example.com/upload',
    'http GET https://api.github.com/repos/o/r/pulls/5/merge',
    'curl https://api.github.com/repos/o/r/pulls/5/comments?per_page=100',
    'curl -s https://api.github.com/repos/o/r/pulls/5/files?page=2',
    'curl -X GET https://api.github.com/repos/o/r/pulls/5/merg[e]',
    "curl -X PUT 'https://api.github.com/repos/o/r/pulls/5/merg[e]'",
    'curl -X PUT https://example.com/up[l]oad',
    'http get https://api.github.com/repos/o/r/pulls/$N',
    'curl -X get https://api.github.com/repos/o/r/pulls/5/merg[e]',
    'curl -X PUT http://localhost:3000/repos/$ID',
    'curl -HX-GitHub-Api-Version:2022-11-28 https://api.github.com/repos/o/r/pulls/5/merge',
    'curl -X GET -HX-Foo:1 https://api.github.com/repos/o/r/pulls/$N',
    'curl -oX.json https://api.github.com/repos/o/r/pulls/$N',
    `curl -H"X-GitHub-Api-Version: $V" ${MERGE_URL}`,
    'curl -sH"X-Api-Key: $KEY" "https://api.$DOMAIN/v1/items"',
    'curl -X POST "$API_URL/users"',
    'curl -X POST ${API_URL}/users',
    'curl -X POST "$SUPABASE_URL/rest/v1/items" -d x',
    'http POST $API/items a=b',
    'wget --post-data a=b "$URL/x"',
    'curl -X POST localhost:$PORT/items',
    'curl -X POST "http://127.0.0.1:${PORT}/x"',
    'http POST localhost:$PORT/items a=b',
    'curl -X POST --output-dir "out-$N/x" https://example.com/y',
    'curl -X POST -t "opt-$N/x" https://example.com/y',
    'curl -X POST --cacert "c-$N/ca.pem" https://example.com/y',
    'case x in (a) {gh} pr create -t x -b y;; esac',
    "{gh} pr merge 5 '--admi(n)'",
    '{gh} pr merge 5 "--admi[n]"',
    '{gh} pr merge 5 --squash -t \\(fix\\)',
    'ls *(.om[1]) && {gh} pr merge 5 --squash',
    "ls *(e:'[[ -d $REPLY ]]':) && {gh} pr merge 5 --squash",
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
    // A file named `-h=false` makes `-h*` run as `-h=false`.
    ['{gh} pr merge 5 --admin -h*', ADMIN_REASON],
  ])('does not take a run-time short help as help: %s', (script, says) => {
    expect(reason(script)).toBe(says);
  });

  it.each([
    '{gh} api -X PUT repos/o/r/pulls/5/merge -h"$X"',
    '{gh} api -X PUT repos/o/r/pulls/5/merge -h*',
  ])('does not take a run-time short help on gh api as help: %s', (script) => {
    expect(reason(script)).toContain(UNREAD);
  });
});
