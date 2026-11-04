// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  afterFlags,
  cdTarget,
  cdWord,
  parseCommands,
  quoteArgv,
  shellScriptOf,
} from './shell-parse.mjs';

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
