// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hasRunTimeHost, readHttpRequest } from './http-flags.mjs';
import { parseCommands, wordsOf } from './shell-parse.mjs';

// The program and its words in a one-command script.
const request = (script: string) => {
  const [program, ...args] = wordsOf(parseCommands(script)[0]!);
  return readHttpRequest(program!.text, args);
};

describe('hasRunTimeHost', () => {
  it.each([
    ['https://api.$D/repos/o/r', true],
    ['api.github.c[o]m/repos', true],
    ['https://$A.$B/x', true],
    ['$API_URL/users', false],
    ['${API_URL}/users', false],
    ['https://$H/x', false],
    ['localhost:$PORT/items', false],
    ['http://127.0.0.1:${PORT}/x', false],
    ['$URL', false],
    ['https://example.com/$P', false],
  ])('%s: %s', (text, expected) => {
    expect(hasRunTimeHost(text)).toBe(expected);
  });
});

describe('readHttpRequest: writes', () => {
  it.each([
    ['curl -X PUT u', true],
    ['curl -sXPUT u', true],
    ['curl -XP?T u', true],
    ['curl -X "$M" u', true],
    ['curl --request=PUT u', true],
    ['curl -S -X PUT u', true],
    ['curl -d x u', true],
    ['curl --data-raw x u', true],
    ['wget --method=PUT u', true],
    ['wget --post-data=x u', true],
    ['http PUT u', true],
    ['http --timeout 5 PUT u', true],
    ['http -S PUT u', true],
    ['http "$M" u', true],
    ['http u a=b', true],
    ['curl u', false],
    ['curl -XGET u', false],
    ['curl -X GET -HX-Foo:1 u', false],
    ['curl -HX-GitHub-Api-Version:2022-11-28 u', false],
    ['curl -oX.json u', false],
    ['http get u', false],
    ['http u a==b', false],
    ['http $URL', false],
  ])('%s: %s', (script, writes) => {
    expect(request(script)?.writes).toBe(writes);
  });

  it('is null for a program that is not an HTTP client', () => {
    expect(request('git push')).toBeNull();
  });
});

describe('readHttpRequest: url words', () => {
  it.each([
    ['curl -H x -o out -X PUT u', ['u']],
    ['curl --header x --url u', ['u']],
    ['curl -X PUT -- -u', ['-u']],
    ['http PUT u a=b h:v', ['u', 'h:v']],
    ['wget -O out u', ['u']],
  ])('%s', (script, urls) => {
    expect(request(script)?.urls.map(({ text }) => text)).toEqual(urls);
  });
});
