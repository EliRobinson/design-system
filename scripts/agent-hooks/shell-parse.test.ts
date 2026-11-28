// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GLOB_GROUP_WORD,
  GLOB_NESTING_LIMIT,
  GLOB_WORK_LIMIT,
  MAX_EVAL_DEPTH,
  afterFlags,
  cdTarget,
  cdWord,
  ghCommand,
  newParseState,
  parseCommands,
  quoteArgv,
  shellScriptOf,
} from './shell-parse.mjs';
import {
  NESTED_GLOB_NAMES,
  TIME_BUDGET_MS,
  atRoot,
  msToRun,
  nestedGlobOf,
  nestedPlainGroups,
  unclosedGlobChain,
} from './shell-parse-fixtures';

const argvs = (script: string) => parseCommands(script).map(({ argv }) => argv);
const names = (script: string) => argvs(script).map((argv) => argv[0]);

describe('parseCommands', () => {
  it('splits on operators and newlines', () => {
    expect(names('a && b || c; d | e & f\ng')).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('joins quoted and escaped parts of a word', () => {
    expect(argvs(`g''h "a b" c\\ d`)).toEqual([['gh', 'a b', 'c d']]);
  });

  it('drops env assignments, keywords, and wrappers with their flags', () => {
    expect(names('A=1 B=2 x')).toEqual(['x']);
    expect(names('if true; then x; fi')).toEqual(['true', 'x']);
    expect(names('sudo -u me env -u FOO nice -n 5 x')).toEqual(['x']);
    expect(names('timeout 60 x')).toEqual(['x']);
    expect(names('timeout -s KILL 60 x')).toEqual(['x']);
    expect(names('/usr/bin/time -f %e x')).toEqual(['x']);
    expect(names('command -- x')).toEqual(['x']);
  });

  it('keeps the env assignments it drops, per command', () => {
    const envs = (script: string) => parseCommands(script).map(({ env }) => env);
    expect(envs('A=1 B=2 x && y')).toEqual([['A=1', 'B=2'], []]);
    expect(envs('sudo env C=3 x')).toEqual([['C=3']]);
    expect(envs('export D=4; x')).toEqual([[], []]);
  });

  it('reads function bodies', () => {
    expect(names('function f { x; }; f')).toContain('x');
    expect(names('f() { x; }; f')).toContain('x');
  });

  it('finds commands inside substitutions, bash -c, and eval', () => {
    expect(names('echo "$(x)"')).toContain('x');
    expect(names('echo `x`')).toContain('x');
    expect(names('echo "`x`"')).toContain('x');
    expect(names('echo $( (x) )')).toContain('x');
    expect(names('bash -o pipefail -c "x"')).toContain('x');
    expect(names('eval "x y"')).toContain('x');
  });

  // Each word after `x` and how it is marked. A substitution's commands come
  // first, so find `x` itself.
  const marksAfterX = (script: string) =>
    parseCommands(script)
      .find(({ argv }) => argv[0] === 'x')
      ?.marks.slice(1)
      .map(({ dynamic, splits }) => splits || (dynamic ? 'dynamic' : 'plain'));

  it.each([
    ['plain', 'x a \'$b\' \\$c "d" repos/{owner}/{repo} a$ { y; }'],
    ['unquoted', 'x $a ${b} $(c) `d` $((1+2)) a$b {a,b} pre{1..3}'],
    ['plain', 'x \'*\' "a?b" \\* a\\?b \\[ab] "[ab]" [ [[ ]] a]'],
    ['unquoted', 'x * a* ?b --admi[n] m[!a] "a"* \'b\'?'],
    // A `[` closed later in the word, with quoted members (#459).
    ['unquoted', 'x --admi[" "n] --admi[n\\ ] [a"]" [\'a b\']'],
    ['plain', 'x \'--admi(n)\' "--admi[n]" \\(a\\) a\\(b\\)'],
    ['dynamic', 'x "$a" "${b}" "$(c)" "`d`" $\'e\' $"f" "$*"'],
    ['always', 'x "$@" "${a[@]}" "$a[*]" "${=a}" "${(f)a}" $a"$@"'],
  ])('marks every word in a %s case: %s', (kind, script) => {
    const marks = marksAfterX(script) ?? [];
    expect(marks.length).toBeGreaterThan(0);
    expect(new Set(marks)).toEqual(new Set([kind]));
  });

  // A `(` glued to a word: a zsh glob group or a bash extglob (#459).
  it.each([
    '--admi(n|x)',
    '--admi@(n)',
    '+(a)',
    '*(N)',
    '!(x)',
    '?(a)',
    '"a"(b)',
    'a(b)c',
    '(a|b)',
  ])('marks the word a ( is glued to as a filename pattern: %s', (form) => {
    expect(marksAfterX(`x ${form}`)).toEqual(['unquoted']);
  });

  it.each([
    ['( cd a; y )', ['cd', 'y']],
    ['a=(1 $(y)) && z', ['y', '1', 'z']],
    ['local a+=(1) && z', ['local', '1', 'z']],
    ['diff =(y) z', ['diff', 'y', 'z']],
    ['f() { y; }; z', ['f', 'y', 'z']],
    ['case a in a) y;; esac', ['case', 'y']],
    ['case a in (a) y;; esac', ['case', 'a', 'y']],
    ['case a in @(a|b)) y;; esac', ['case', 'a', 'b', 'y']],
    ['case x in(x) y;; esac', ['case', 'x', 'y']],
    ['while(y) do z; done', ['y', 'z']],
    ['!(y) && z', ['y', 'z']],
    ['if !(y); then z; fi', ['y', 'z']],
    ['time(y) && z', ['y', 'z']],
    ['true && time(y)', ['true', 'y']],
    ['select(y); z', ['select', 'y', 'z']],
    ['echo $(f( ) { y; }; f) z', ['f', 'y', 'f', 'echo']],
    ['echo $(x a( ) y) z', ['x', 'y', 'echo']],
    ['time -p(y) && z', ['y', 'z']],
    ['! time -p(y)', ['y']],
    ['echo $(time -p(y))', ['y', 'echo']],
    ['x --admi(n|y) z', ['x', 'n', 'y', 'z']],
  ])('reads the commands in a ( glued to a word, as a subshell: %s', (script, expected) => {
    expect(names(script).filter((name) => name !== undefined)).toEqual(expected);
  });

  // zsh glob qualifiers that run code (#465): an `e` string runs as shell
  // code, read as an `eval` script. Each case finds `y a` right after it.
  it.each([
    "x *(e:'y a':)",
    'x *(e:"y a":)',
    "x *(e['y a'])",
    "x *(e{'y a'})",
    "x *(eX'y a'X)",
    "x *(e':y a':)",
    'x *(e:y\\ a:)',
    "x *(.e:'y a':)",
    "x *(oe:'y a':)",
    "x *(Ne:'y a':)",
    "x *(a-1e:'y a':)",
    "x *(f-100e:'y a':)",
    "x *(u0e:'y a':)",
    "x *(P:p:e:'y a':)",
    "x *([1]e:'y a':)",
    "x *(e:'w':e:'y a':)",
    "x *(e:'y a'::h)",
    "x f1(e:'y a':)",
    'x "f"(e:\'y a\':)',
    "x **(e:'y a':)",
    "x (e:'y a':)",
    "x (a|b)(e:'y a':)",
    "x *(N)(e:'y a':)",
    "time(e:'y a':)",
    "x *(e:'y a':) && z",
    "x a(e{x a(e{'y a'})})",
    // An inner group is read when the group around it does not read it.
    "x a(b(e:'y a':)",
    "{ x a(b(e:'y a':) }",
    "echo `x a(b(e:'y a':)`",
    "case w in w) x a(b(e:'y a':) ;; esac",
    "for f (*(e:'y a':)) :",
    "for f ( (a)(e:'y a':) ) echo",
  ])('reads the e string of a glob qualifier as commands: %s', (script) => {
    const commands = parseCommands(script);
    const y = commands.findIndex(({ argv }) => argv[0] === 'y');
    expect(commands.slice(y - 1, y + 1).map(({ argv }) => argv)).toEqual([
      ['eval', 'y a'],
      ['y', 'a'],
    ]);
  });

  // What the qualifier reading adds: the commands in the body e strings run
  // in. The group's own words are read as a subshell too.
  const qualifierCommands = (script: string) =>
    parseCommands(script).filter(({ scope }) => (scope.at(-1) ?? 0) < 0);
  const runTimePrograms = (script: string) =>
    qualifierCommands(script)
      .filter(({ marks }) => marks[0]?.dynamic)
      .map(({ argv }) => argv[0]);

  // A `+name` qualifier calls a command the hook cannot see, and an
  // expansion may build any qualifier, so each counts as built at run time.
  it.each([
    ['x *(+fn)', ['fn']],
    ['x *(+fn:t)', ['fn']],
    ["x *(+'fn')", ['fn']],
    ['x *($X)', [GLOB_GROUP_WORD]],
    ['x *(e:"$X":)', ['$X', GLOB_GROUP_WORD]],
    ['x *(e:$X:)', ['$X', GLOB_GROUP_WORD]],
    // The e string `y` runs, and so does the substitution in it first.
    ['x *(e:`y`:)', ['`y`', GLOB_GROUP_WORD]],
    ["x *(e:$'y':)", ['$y', GLOB_GROUP_WORD]],
    ['x *(e:{y,z}:)', ['{y,z}', GLOB_GROUP_WORD]],
    ["x *({'d'..f}1y)", [GLOB_GROUP_WORD]],
    ['x *(e:y)', [GLOB_GROUP_WORD]],
    ['x *(e)', [GLOB_GROUP_WORD]],
  ])('reads a glob qualifier it cannot follow as built at run time: %s', (script, expected) => {
    expect(runTimePrograms(script)).toEqual(expected);
  });

  // Each glob group built at run time gets its own mark, in the scope its code runs in.
  const globMarks = (script: string) =>
    parseCommands(script).filter(({ argv }) => argv[0] === GLOB_GROUP_WORD);

  it('marks each glob group built at run time', () => {
    expect(globMarks('x *($X) *($Y)')).toHaveLength(2);
  });

  it('marks a glob group built at run time in the subshell it runs in', () => {
    const [ls] = parseCommands('(ls *($X))');
    expect(globMarks('(ls *($X))').map(({ scope }) => scope[0])).toEqual([ls?.scope[0]]);
  });

  it('marks glob groups built at run time in a background job and a coproc', () => {
    const script = 'x *($X) & coproc ls *($Y)';
    const [x] = parseCommands(script);
    expect(globMarks(script).map(({ scope, async }) => [scope[0] === x?.scope[0], async])).toEqual([
      [true, true],
      [false, true],
    ]);
  });

  it.each([
    'x *(N)',
    'x *(.om[1])',
    'x *(:e)',
    'x *(u:root:)',
    'x *(f:u+r:)',
    'x *(Lk+0)',
    'x --admi(n|x)',
    'a=(e:y:)',
    "local a=(e:'y':)",
    "A=1 a+=(e:'y':) x",
  ])('reads no code from a glob group whose qualifiers run none: %s', (script) => {
    expect(qualifierCommands(script)).toEqual([]);
  });

  it('runs an e string in a body of the shell that expands the word', () => {
    const scopes = parseCommands("x *(e:'cd a':); b").map(({ argv, scope }) => [
      argv[0],
      scope.map(Math.sign),
    ]);
    expect(scopes).toEqual([
      ['x', []],
      ['e:cd a:', [1]],
      ['eval', [-1]],
      ['cd', [-1]],
      ['b', []],
    ]);
  });

  // A `}` or `esac` that ends a glob group early reads the groups in it
  // there, before what comes after.
  it.each([
    ["{ x a(b(e:'cd a':) }; y", ['x', 'b', 'e:cd a:', 'eval', 'cd', 'y']],
    ["case w in w) x a(b(e:'cd a':) ;; esac; y", ['case', 'x', 'b', 'e:cd a:', 'eval', 'cd', 'y']],
  ])('reads a glob group a closer ends where it ends: %s', (script, expected) => {
    expect(names(script)).toEqual(expected);
  });

  it('runs an e string in a coprocess when the group is one', () => {
    const cd = parseCommands("coproc x a(e:'cd a':)").find(({ argv }) => argv[0] === 'cd');
    expect(cd?.async).toBe(true);
  });

  // Each nested group is read once, from the e string around it, and each
  // group's text once (#465). Linear work keeps the hooks inside their
  // timeouts; quadratic work on these took minutes.
  it.each([
    ['nested groups', nestedPlainGroups(8000)],
    ['nested groups with e strings', `ls ${'a(e:true:b('.repeat(3000)}${')'.repeat(6000)}`],
    ['glob groups that never close', unclosedGlobChain(8000)],
    ...NESTED_GLOB_NAMES.map((form) => [`${form} nested 1000 deep`, nestedGlobOf(form, 1000)]),
  ])('parses %s in a time budget', (_, script) => {
    expect(msToRun(() => parseCommands(script))).toBeLessThan(TIME_BUDGET_MS);
  });

  // #480: past the depth, a plain eval's script is not read at all. Whoever
  // fixes #480 changes this test and the "does not catch" line in the docs.
  const nestedEval = (depth: number) => {
    let script = 'y';
    for (let at = 0; at < depth; at++) script = `eval ${quoteArgv([script])}`;
    return script;
  };

  it('reads a plain eval nested 4 deep', () => {
    expect(parseCommands(nestedEval(4)).map(({ argv }) => argv[0])).toContain('y');
  });

  it('reads nothing from a plain eval nested past the depth, and marks nothing (#480)', () => {
    const commands = parseCommands(nestedEval(MAX_EVAL_DEPTH + 1));
    expect(commands.map(({ argv }) => argv[0])).not.toContain('y');
    expect(commands.some(({ marks }) => marks.some(({ dynamic }) => dynamic))).toBe(false);
  });

  it('counts e strings past the work limit as built at run time', () => {
    const script = Array.from({ length: GLOB_WORK_LIMIT + 1 }, () => "x *(e:'y':)").join('; ');
    expect(runTimePrograms(script).at(-1)).toBe('y');
  });

  it('does not count cheap glob groups toward the e string limit', () => {
    const script = `ls ${'x(+a)'.repeat(GLOB_WORK_LIMIT + 1)} *(e:'y':)`;
    const y = parseCommands(script).find(({ argv }) => argv[1] === 'y');
    expect(y?.origin).toBe('glob');
  });

  const nestingMarkers = (script: string) =>
    parseCommands(script).filter(({ argv }) => argv[0] === GLOB_GROUP_WORD).length;

  // The innermost `a()` is a function name, not a group, so 2 more than the limit.
  it.each([
    [nestedPlainGroups(GLOB_NESTING_LIMIT + 2), 1],
    [
      `${nestedPlainGroups(GLOB_NESTING_LIMIT + 2)}; ${nestedPlainGroups(GLOB_NESTING_LIMIT + 2)}`,
      2,
    ],
  ])('counts each glob group nest past the limit as built at run time', (script, markers) => {
    expect(nestingMarkers(script)).toBe(markers);
  });

  it('marks an array assignment as built at run time, as before glob groups were read', () => {
    expect(parseCommands('local a=(x y)')[0]?.marks.map(({ dynamic }) => dynamic)).toEqual([
      false,
      true,
    ]);
  });

  it('takes a parse state from newParseState', () => {
    const state = newParseState();
    parseCommands("x *(e:'y':)", 0, [], state);
    expect(state.globWork).toBe(1);
  });

  // The limits the hook docs name are the ones the parser uses.
  it.each([
    [
      `Past ${MAX_EVAL_DEPTH} levels of nested \`eval\`, \`bash -c\` and \`e\` strings together, the inner script is not read at all (#480)`,
    ],
    [
      `nested past ${MAX_EVAL_DEPTH} levels: it is not read at all, and does not count as built at run time (#480)`,
    ],
    [
      `past ${GLOB_WORK_LIMIT.toLocaleString('en-US')} commands in all the \`e\` strings one call reads`,
    ],
    [`a glob group nested more than ${GLOB_NESTING_LIMIT} deep in another`],
    [
      `past the ${GLOB_WORK_LIMIT.toLocaleString('en-US')}-command or ${GLOB_NESTING_LIMIT}-deep limits above`,
    ],
  ])('names its limit in git-and-prs.md: %s', (phrase) => {
    expect(readFileSync(atRoot('docs/agents/git-and-prs.md'), 'utf8')).toContain(phrase);
  });

  // bash's `coproc [NAME] command` (#468). zsh reads only the forms with no NAME.
  it.each([
    ['coproc foo { y; }; z', ['coproc', 'y', 'z']],
    ['coproc foo { y; w; }', ['coproc', 'y', 'w']],
    ['coproc foo ( y ); z', ['coproc', 'y', 'z']],
    ['coproc foo(y)', ['coproc', 'y']],
    ['coproc { y; }; z', ['coproc', 'y', 'z']],
    ['coproc ( y ); z', ['coproc', 'y', 'z']],
    ['coproc(y) && z', ['coproc', 'y', 'z']],
    ['coproc foo while x; do y; done', ['coproc', 'x', 'y']],
    ['coproc foo if x; then y; fi', ['coproc', 'x', 'y']],
    ['coproc y a', ['coproc', 'y']],
    ['coproc env A=1 y a', ['coproc', 'y']],
    ['coproc bash -c "y"', ['coproc', 'bash', 'y']],
    ['x && coproc foo { y; }', ['x', 'coproc', 'y']],
    ['if x; then coproc foo { y; }; fi; z', ['x', 'coproc', 'y', 'z']],
    ['echo $(coproc foo { y; })', ['coproc', 'y', 'echo']],
  ])('reads the command a coproc runs: %s', (script, expected) => {
    expect(names(script)).toEqual(expected);
  });

  it('reads the body of a coproc NAME for loop', () => {
    expect(names('coproc foo for a in b; do y; done')).toEqual(['coproc', 'for', 'y']);
  });

  // A `}`, `done` or `esac` still in the command closes its body before the
  // `)` after it closes the `$(`, so what follows is back in the outer shell.
  it.each(['echo $({ y; }); b', 'x=$(for i in a; do :; done); b', 'echo $(coproc foo { y; }); b'])(
    'ends a body before the ) that closes its substitution: %s',
    (script) => {
      const b = parseCommands(script).find(({ argv }) => argv[0] === 'b');
      expect(b?.scope).toEqual([]);
    },
  );

  // A `&` sends its whole and-or list to the background; a `;` inside a
  // group ends a list in the group only.
  it.each([
    ['git worktree add p & cd p && git commit', [true, false, false]],
    ['a && b & c', [true, true, false]],
    ['(git worktree add p; true) & c', [true, true, false]],
    ['{ git worktree add p; true; } & c', [true, true, false]],
    ['a; (b; c) & d', [false, true, true, false]],
    ['x && (y; z) & w', [true, true, true, false]],
    ['if a; then b; fi & c', [true, true, false]],
    ['(a; b & c; d) & e', [true, true, true, true, false]],
    ['(a; b & c; d); e', [false, true, false, false, false]],
  ])('marks the commands a background job runs as async: %s', (script, expected) => {
    expect(parseCommands(script).map(({ async }) => async)).toEqual(expected);
  });

  it.each([
    ['coproc foo { y a; }', ['y', 'a']],
    ['coproc y a', ['y', 'a']],
  ])('reads a coproc’s words past its NAME and keyword: %s', (script, expected) => {
    expect(argvs(script).at(-1)).toEqual(expected);
  });

  const placed = (script: string) =>
    parseCommands(script).map(({ argv, scope, async }) => ({ name: argv[0], scope, async }));

  it('runs a coproc’s simple command in a coprocess shell of its own', () => {
    const [raw, cd, after] = placed('coproc cd a; b');
    expect(cd?.name).toBe('cd');
    expect(cd?.scope).toHaveLength(1);
    expect(cd?.async).toBe(true);
    // The record of the coproc itself shares the coprocess's shell.
    expect(raw).toEqual({ name: 'coproc', scope: cd?.scope, async: true });
    expect(after).toEqual({ name: 'b', scope: [], async: false });
  });

  it.each([
    'coproc foo { y; w; }; z',
    'coproc { y; w; }; z',
    'coproc foo while y; do w; done; z',
    'coproc foo ( y; w ); z',
    'time coproc foo { y; w; }; z',
    'x && coproc foo { y; w; }; z',
  ])('runs every command of a coproc’s body in the coprocess shell: %s', (script) => {
    const commands = placed(script);
    const y = commands.find(({ name }) => name === 'y');
    const w = commands.find(({ name }) => name === 'w');
    const z = commands.find(({ name }) => name === 'z');
    expect(y?.scope[0]).toBeGreaterThan(0);
    expect(w?.scope).toEqual(y?.scope);
    expect([y?.async, w?.async]).toEqual([true, true]);
    expect(z).toEqual({ name: 'z', scope: [], async: false });
  });

  it('closes a coproc’s body at its own closer, not the group around it', () => {
    const commands = placed('(coproc foo { y; }; cd a); b');
    const y = commands.find(({ name }) => name === 'y');
    const cd = commands.find(({ name }) => name === 'cd');
    expect(cd?.scope).toHaveLength(1);
    expect(cd?.async).toBe(false);
    expect(y?.scope.slice(0, 1)).toEqual(cd?.scope);
    expect(commands.at(-1)).toEqual({ name: 'b', scope: [], async: false });
  });

  it('marks commands in a substitution or a nested shell inside a coproc as async', () => {
    const commands = placed('coproc foo { echo $(y) && bash -c "w"; }');
    const inner = commands.filter(({ name }) => name === 'y' || name === 'w');
    expect(inner.map(({ async }) => async)).toEqual([true, true]);
  });

  it('keeps one mark per word past dropped env assignments and wrappers', () => {
    const [command] = parseCommands('A=$x timeout 5 gh "$y" z');
    expect(command?.argv).toEqual(['gh', '$y', 'z']);
    expect(command?.marks.map(({ dynamic }) => dynamic)).toEqual([false, true, false]);
  });

  it('does not mark a redirect target as a word', () => {
    const [command] = parseCommands('x > $out a');
    expect(command?.argv).toEqual(['x', 'a']);
    expect(command?.marks.map(({ dynamic }) => dynamic)).toEqual([false, false]);
  });

  it('marks which commands run in the script’s own shell', () => {
    const top = (script: string) =>
      parseCommands(script).map(({ argv, top: isTop }) => `${argv[0]}:${isTop}`);
    expect(top('a && b')).toEqual(['a:true', 'b:true']);
    expect(top('(a); b')).toEqual(['a:false', 'b:true']);
    expect(top('echo $(a)')).toEqual(['a:false', 'echo:true']);
    expect(top('bash -c "a"')).toEqual(['bash:true', 'a:false']);
    expect(top('a | b; c')).toEqual(['a:false', 'b:false', 'c:true']);
    expect(top('a |& b')).toEqual(['a:false', 'b:false']);
    expect(top('a & b')).toEqual(['a:false', 'b:true']);
    expect(top('a && b || c')).toEqual(['a:true', 'b:true', 'c:true']);
    expect(top('a &> out; b &>> out')).toEqual(['a:true', 'b:true']);
  });

  it('lists commands in the order they run', () => {
    expect(names('echo $(a); b; bash -c "c"; d')).toEqual(['a', 'echo', 'b', 'bash', 'c', 'd']);
    expect(names('eval "a"; b')).toEqual(['eval', 'a', 'b']);
  });

  it('gives commands in one shell the same scope, and others their own', () => {
    const scopes = (script: string) => parseCommands(script).map(({ scope }) => scope);
    const [a, b, c, d] = scopes('(a; b); c; (d)');
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
    expect(c).toEqual([]);
    expect(d).toHaveLength(1);
    expect(d).not.toEqual(a);
    const [p, q] = scopes('p | q');
    expect(p).not.toEqual(q);
    const [inner, outer] = scopes('x $(y)');
    expect(outer).toEqual([]);
    expect(inner).toHaveLength(1);
    const [, nested] = scopes('(bash -c "z")');
    expect(nested).toHaveLength(2);
  });

  it('sends a whole and-or list to the background with &', () => {
    const top = (script: string) => parseCommands(script).map(({ top: isTop }) => isTop);
    expect(top('a && b & c')).toEqual([false, false, true]);
    expect(top('a; b && c & d')).toEqual([true, false, false, true]);
    expect(top('a && (b &); c')).toEqual([true, false, true]);
  });

  it('keeps a bare assignment as a command with no words', () => {
    expect(parseCommands('A=1; x').map(({ argv, env }) => [argv, env])).toEqual([
      [[], ['A=1']],
      [['x'], []],
    ]);
  });

  it('runs eval in the shell that runs it', () => {
    const [evalCommand, inner] = parseCommands('eval "x"');
    expect(inner?.scope).toEqual(evalCommand?.scope);
  });

  it('gives a compound body a negative scope id, inside a pipe stage when piped into', () => {
    const scopes = (script: string) => parseCommands(script).map(({ scope }) => scope);
    const [inBraces, after] = scopes('{ a; }; b');
    expect(inBraces?.[0]).toBeLessThan(0);
    expect(after).toEqual([]);
    const [, x, y] = scopes('echo | { x; y; }');
    expect(x).toEqual(y);
    expect(x).toHaveLength(2);
    expect(x?.[1]).toBeLessThan(0);
    expect(scopes('if a; then b; fi; c').at(-1)).toEqual([]);
  });

  it('skips redirect targets and file descriptors', () => {
    expect(argvs('x > out.txt 2>&1 < in.txt')).toEqual([['x']]);
  });

  it('skips comments', () => {
    expect(names('a # b; c')).toEqual(['a']);
  });

  it('blanks heredoc bodies', () => {
    expect(names("cat <<'EOF'\nx\n(y)\nEOF\nz")).toEqual(['cat', 'z']);
    expect(names('cat <<-END\n\tx\n\tEND\nz')).toEqual(['cat', 'z']);
    expect(names('cat <<A <<B\nx\nA\ny\nB\nz')).toEqual(['cat', 'z']);
    expect(names('echo "$(cat <<\'EOF\'\nx )\nEOF\n)"')).not.toContain('x');
  });

  it('does not take here-strings, quoted <<, or shifts for heredocs', () => {
    expect(names('grep -q a <<< foo\nx')).toContain('x');
    expect(names('echo "a <<Z"\nx')).toContain('x');
    expect(names("echo 'a <<Z'\nx")).toContain('x');
    expect(names('echo $((1 << y))\nx')).toContain('x');
    expect(names('(( n = 1 << 2 ))\nx')).toContain('x');
  });
});

describe('cdTarget', () => {
  it('resolves a literal target from the folder', () => {
    expect(cdTarget('/a/b', 'c')).toBe('/a/b/c');
    expect(cdTarget('/a/b', '../c')).toBe('/a/c');
    expect(cdTarget('/a/b', '/x')).toBe('/x');
  });

  it('keeps a relative folder relative', () => {
    expect(cdTarget('.', 'sub')).toBe('sub');
    expect(cdTarget('a', 'b/c')).toBe('a/b/c');
    expect(cdTarget('a', '../b')).toBe('b');
    expect(cdTarget('.', '/abs//x/')).toBe('/abs/x');
    expect(cdTarget('/a', 'b/')).toBe('/a/b');
    expect(cdTarget('.', 'sub/')).toBe('sub');
    expect(cdTarget('/a', '/')).toBe('/');
    expect(cdTarget('/', '..')).toBe('/');
  });

  it('is null when it cannot tell', () => {
    for (const target of [undefined, '-', '-P', '~', '~/x', '$X', '"$(pwd)"', '`pwd`']) {
      expect(cdTarget('/a', target)).toBeNull();
    }
    expect(cdTarget(null, 'x')).toBeNull();
  });
});

describe('shellScriptOf', () => {
  it('returns the -c script of a shell', () => {
    expect(shellScriptOf(['bash', '-lc', 'x'])).toBe('x');
    expect(shellScriptOf(['/bin/sh', '-c', 'x'])).toBe('x');
  });

  it('returns null for other commands', () => {
    expect(shellScriptOf(['bash', 'script.sh'])).toBeNull();
    expect(shellScriptOf(['node', '-c', 'x'])).toBeNull();
  });
});

describe('quoteArgv', () => {
  it('round-trips through parseCommands', () => {
    const argv = ['gh', 'pr', 'create', '-F', "my body's.md", '#', '$(x)'];
    expect(argvs(quoteArgv(argv))).toEqual([argv]);
  });
});

describe('cdWord', () => {
  const word = (script: string) => cdWord(parseCommands(script)[0]?.argv ?? []);

  it('reads the target of every cd form both hooks follow', () => {
    expect(word('cd a')).toBe('a');
    expect(word('cd "quoted path"')).toBe('quoted path');
    expect(word('cd /abs/dir')).toBe('/abs/dir');
    expect(word('cd ../rel')).toBe('../rel');
    expect(word('cd -')).toBe('-');
    expect(word('cd')).toBeUndefined();
    expect(word('pushd a')).toBe('a');
  });

  it('skips link flags and --', () => {
    expect(word('cd -P /x')).toBe('/x');
    expect(word('cd -L -e -@ /x')).toBe('/x');
    expect(word('cd -- /x')).toBe('/x');
    expect(word('cd -P -- -weird')).toBe('-weird');
  });

  it('gives the same folder in both hooks for a flagged cd', () => {
    expect(cdTarget('/a', word('cd -P b'))).toBe('/a/b');
    expect(cdTarget('/a', word('cd -P -'))).toBeNull();
    expect(cdTarget('/a', word('cd'))).toBeNull();
  });
});

describe('afterFlags', () => {
  const values = new Set(['-R', '--repo']);

  it('drops leading flags and the values of value flags', () => {
    expect(afterFlags(['-R', 'o/r', 'pr', 'create'], values)).toEqual(['pr', 'create']);
    expect(afterFlags(['--repo=o/r', '-x', 'pr'], values)).toEqual(['pr']);
    expect(afterFlags(['pr', '-R', 'x'], values)).toEqual(['pr', '-R', 'x']);
    expect(afterFlags([], values)).toEqual([]);
  });
});

describe('ghCommand', () => {
  const gh = (script: string) => ghCommand(parseCommands(script)[0]?.argv ?? []);

  it('reads the group and subcommand past gh flags', () => {
    expect(gh('gh pr create -t x')).toMatchObject({
      group: 'pr',
      sub: 'create',
      subArgs: ['-t', 'x'],
    });
    expect(gh('gh -R o/r pr checkout 5')).toMatchObject({ group: 'pr', sub: 'checkout' });
    expect(gh('gh --repo=o/r pr -R x new')).toMatchObject({ group: 'pr', sub: 'new' });
    expect(gh('gh api graphql')).toMatchObject({ group: 'api', rest: ['graphql'] });
    expect(gh('/usr/bin/gh pr create')).toMatchObject({ group: 'pr' });
  });

  it('is null for another program or a bare gh', () => {
    expect(gh('git pr create')).toBeNull();
    expect(gh('gh')).toBeNull();
  });
});
