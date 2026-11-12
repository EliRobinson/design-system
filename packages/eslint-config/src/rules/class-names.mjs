// Reading Tailwind classes, shared by the rules that check them: where a
// className string can be found, and the arbitrary values inside one.

import { staticStrings } from './ast-strings.mjs';

/** The class-name helpers read by default; `classNameFunctions` overrides it. */
export const DEFAULT_CLASS_NAME_FUNCTIONS = [
  'cn',
  'clsx',
  'classnames',
  'classNames',
  'cva',
  'twMerge',
];

/** Matches one arbitrary value: `min-h-[44px]`, and the utility before it. */
export const ARBITRARY_VALUE = /([\w-]+)-\[([^\]]+)\]/g;

/**
 * Tailwind arbitrary values: rounded-[8px] -> { utility: 'rounded', value: '8px' }.
 * An underscore in the value is Tailwind's spelling of a space.
 *
 * @param {string} className
 */
export function* arbitraryValues(className) {
  for (const [, utility, value] of className.matchAll(ARBITRARY_VALUE)) {
    yield { utility, value: value.replaceAll('_', ' ') };
  }
}

/** `cn(...)` and `utils.cn(...)` are both `cn`. */
function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    return callee.property.name;
  }
  return null;
}

/**
 * The string keys of a helper's object arguments: `clsx({ 'min-h-11': open })`
 * names its classes in the keys. Only string keys are read; an identifier key
 * cannot hold `[` or `-`, so it can never carry what a rule looks for.
 *
 * @param {object} node a call argument
 * @param {string[]} [out]
 * @returns {string[]}
 */
function objectKeys(node, out = []) {
  if (node?.type === 'ObjectExpression') {
    for (const property of node.properties) {
      if (
        property.type === 'Property' &&
        property.key.type === 'Literal' &&
        typeof property.key.value === 'string'
      ) {
        out.push(property.key.value);
      }
    }
  } else if (node?.type === 'ArrayExpression') {
    for (const element of node.elements) objectKeys(element, out);
  }
  return out;
}

/**
 * The visitors that find every static className string: a `className` or
 * `class` attribute, and the arguments of a class-name helper call. Calls are
 * not descended into from the attribute, so `className={cn('a')}` reaches
 * `check` once, from the call. A helper's arguments are read for their
 * strings and for the string keys of an object argument.
 *
 * @param {string[]} functions class-name helper names
 * @param {(node: object, className: string) => void} check
 */
export function classNameVisitors(functions, check) {
  const helpers = new Set(functions);
  return {
    JSXAttribute(node) {
      const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
      if (name !== 'className' && name !== 'class') return;
      for (const value of staticStrings(node.value)) check(node, value);
    },

    CallExpression(node) {
      const callee = calleeName(node.callee);
      if (!callee || !helpers.has(callee)) return;
      for (const argument of node.arguments) {
        for (const value of staticStrings(argument)) check(node, value);
        for (const key of objectKeys(argument)) check(node, key);
      }
    },
  };
}
