// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { flagSet, readApiCall, readGhFlags, urlPath } from './gh-flags.mjs';
import { parseCommands, wordsOf } from './shell-parse.mjs';

// The words after the program in a one-command script.
const words = (args: string) => wordsOf(parseCommands(`prog ${args}`)[0]!).slice(1);
const texts = (list: { text: string }[]) => list.map(({ text }) => text);

const VALUE_FLAGS = flagSet('body-file method', ['-F', '-X']);
const read = (args: string) => readGhFlags(words(args), VALUE_FLAGS);

describe('readGhFlags: values', () => {
  it.each([
    ['--body-file=b.md', 'b.md'],
    ['--body-file b.md', 'b.md'],
    ['-Fb.md', 'b.md'],
    ['-F b.md', 'b.md'],
    ['-F=b.md', 'b.md'],
    ['-dF b.md', 'b.md'],
    ['-dF=b.md', 'b.md'],
  ])('%s', (args, value) => {
    expect(texts(read(args).values('-F', '--body-file'))).toEqual([value]);
  });

  it('keeps every value in command order, across aliases', () => {
    expect(texts(read('--body-file a.md -F b.md').values('-F', '--body-file'))).toEqual([
      'a.md',
      'b.md',
    ]);
  });

  it('does not read a flag out of a flag value', () => {
    const flags = read('-F --web x');
    expect(flags.has('--web')).toBe(false);
    expect(texts(flags.positional)).toEqual(['x']);
  });
});

describe('readGhFlags: boolean flags', () => {
  it.each([
    ['--web', true],
    ['-w', true],
    ['-dw', true],
    ['--web=true', true],
    ['--web=1', true],
    ['--web=t', true],
    ['--web=false', false],
    ['--web=0', false],
    ['--web=f', false],
    ['-w=false', false],
    ['--web=$X', false],
    ['--web --web=false', false],
    ['--web=false --web', true],
    ['-w"$X"', false],
    ['-dw$X', false],
  ])('has: %s', (args, set) => {
    expect(read(args).has('-w', '--web')).toBe(set);
  });

  it.each([
    ['--web=$X', true],
    ['-w"$X"', true],
    ['--web=false', false],
    ['-d', false],
  ])('maybe: %s', (args, set) => {
    expect(read(args).maybe('-w', '--web')).toBe(set);
  });

  it.each([
    ['--web=false', true],
    ['-x', false],
  ])('named: %s', (args, named) => {
    expect(read(args).named('--web')).toBe(named);
  });

  it.each([
    ['-h', true],
    ['-dh', true],
    ['--help=t', true],
    ['--help=false', false],
    ['-h"$X"', false],
    ['-h*', false],
    ['-h?false', false],
    ['-h[=]false', false],
  ])('help: %s', (args, help) => {
    expect(read(args).help).toBe(help);
  });
});

describe('readGhFlags: run-time words', () => {
  it('ends the flags at --', () => {
    const flags = read('-d -- --web "$X"');
    expect(flags.has('--web')).toBe(false);
    expect(texts(flags.positional)).toEqual(['--web', '$X']);
    expect(flags.unreadFlags).toEqual([]);
  });

  it('lists values the shell splits, and run-time flags no value was read from', () => {
    const flags = read('-F $A -X "$B" --$C "$D" -d$E');
    expect(texts(flags.splitValues)).toEqual(['$A']);
    expect(texts(flags.unreadFlags)).toEqual(['--$C', '-d$E']);
  });
});

describe('readApiCall', () => {
  const api = (args: string) => readApiCall(words(args));

  it.each([
    ['repos/o/r', 'GET'],
    ['repos/o/r -f a=b', 'POST'],
    ['repos/o/r --input x.json', 'POST'],
    ['repos/o/r -f a=b -X get', 'GET'],
    ['repos/o/r -X=put', 'PUT'],
    ['repos/o/r -iXPUT', 'PUT'],
  ])('%s is %s', (args, method) => {
    expect(api(args).method).toEqual({ text: method, dynamic: false });
  });

  it('marks a method built at run time', () => {
    expect(api('repos/o/r -X "$M"').method.dynamic).toBe(true);
  });

  it('reads the endpoint and the words after it', () => {
    const call = api('-H a:b repos/o/r extra');
    expect(call.endpoint?.text).toBe('repos/o/r');
    expect(texts(call.more)).toEqual(['extra']);
  });
});

describe('urlPath', () => {
  it.each([
    ['https://api.github.com/repos/o/r/pulls/5/merge?x=1#y', '/repos/o/r/pulls/5/merge'],
    ['repos/o/r/pulls/5/x/../merge/', '/repos/o/r/pulls/5/merge'],
    ['repos/o/r/pulls/5/%6Derge', '/repos/o/r/pulls/5/merge'],
    ['repos/o/r/%E0%A4%A', '/repos/o/r/%E0%A4%A'],
  ])('%s', (text, path) => {
    expect(urlPath(text)).toBe(path);
  });
});
