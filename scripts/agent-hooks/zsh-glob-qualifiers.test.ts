// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TIME_BUDGET_MS, msToRun } from './shell-parse-fixtures';
import { globQualifierCode, readGlobGroupText } from './zsh-glob-qualifiers.mjs';

const none = { scripts: [], programs: [], unreadable: false };

describe('globQualifierCode', () => {
  it.each([
    ['e:y a:', { ...none, scripts: ['y a'] }],
    ['e[y a]', { ...none, scripts: ['y a'] }],
    ['e{y a}', { ...none, scripts: ['y a'] }],
    ['eXy aX', { ...none, scripts: ['y a'] }],
    ['.oe:y:', { ...none, scripts: ['y'] }],
    ['Ne:y:', { ...none, scripts: ['y'] }],
    ['a-1e:y:', { ...none, scripts: ['y'] }],
    ['mh-1e:y:', { ...none, scripts: ['y'] }],
    ['Lk+0e:y:', { ...none, scripts: ['y'] }],
    ['f-100e:y:', { ...none, scripts: ['y'] }],
    ['u0e:y:', { ...none, scripts: ['y'] }],
    ['u:root:e:y:', { ...none, scripts: ['y'] }],
    ['P:p:e:y:', { ...none, scripts: ['y'] }],
    ['[1]e:y:', { ...none, scripts: ['y'] }],
    ['%be:y:', { ...none, scripts: ['y'] }],
    ['e:w:e:y:', { ...none, scripts: ['w', 'y'] }],
    ['e:y::h', { ...none, scripts: ['y'] }],
    ['+fn', { ...none, programs: ['fn'] }],
    ['o+fn', { ...none, programs: ['fn'] }],
    ['om+fn', { ...none, programs: ['fn'] }],
    ['+fn+gn', { ...none, programs: ['fn', 'gn'] }],
    ['e:y:+fn', { ...none, scripts: ['y'], programs: ['fn'] }],
    ['N', none],
    ['.om[1]', none],
    [':e', none],
    ['f:u+r:', none],
    ['n|x', none],
    ['a', none],
    ['e', { ...none, unreadable: true }],
    ['e:y', { ...none, scripts: ['y'], unreadable: true }],
    ['e[y[a]', { ...none, scripts: ['y[a', 'y[a]'], unreadable: true }],
    ['+', { ...none, unreadable: true }],
    ['$Xe:y:', { ...none, unreadable: true }],
    ['u{root}e:y:', { ...none, scripts: ['y'] }],
  ])('%s', (text, expected) => {
    expect(globQualifierCode(text)).toEqual(expected);
  });
});

describe('readGlobGroupText', () => {
  it.each([
    ["e:'y a':", { text: 'e:y a:', dynamic: false }],
    ['e:"y a":', { text: 'e:y a:', dynamic: false }],
    ['e:y\\ a:', { text: 'e:y a:', dynamic: false }],
    ["e:'$REPLY':", { text: 'e:$REPLY:', dynamic: false }],
    ['e:"\\$X":', { text: 'e:$X:', dynamic: false }],
    ['e:"a\\b":', { text: 'e:a\\b:', dynamic: false }],
    ['e:"$X":', { text: 'e:$X:', dynamic: true }],
    ['e:$X:', { text: 'e:$X:', dynamic: true }],
    ['e:$(y):', { text: 'e:$(y):', dynamic: true }],
    ['e:`y`:', { text: 'e:`y`:', dynamic: true }],
    ["e:$'y':", { text: 'e:$y:', dynamic: true }],
    ['e:{y,z}:', { text: 'e:{y,z}:', dynamic: true }],
    ["{'d'..f}1", { text: '{d..f}1', dynamic: true }],
    ["e:'{y,z}':", { text: 'e:{y,z}:', dynamic: false }],
    ['e{y}', { text: 'e{y}', dynamic: false }],
  ])('%s', (raw, expected) => {
    expect(readGlobGroupText(raw)).toEqual(expected);
  });

  // Each brace test reads only up to its `}`, so the text is read once (#465).
  it.each([
    ['unclosed braces', '{'.repeat(200_000)],
    ['brace expansions', '{a,b}'.repeat(200_000)],
  ])('reads %s in a time budget', (_, raw) => {
    expect(msToRun(() => readGlobGroupText(raw))).toBeLessThan(TIME_BUDGET_MS);
  });
});
