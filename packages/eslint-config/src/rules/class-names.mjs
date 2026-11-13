// Reading Tailwind classes, shared by the rules that check them: where a
// className string can be found, and the arbitrary values inside one.

import { jsxAttributeName, staticStrings } from './ast-strings.mjs';

/** The class-name helpers read by default; `classNameFunctions` overrides it. */
const DEFAULT_CLASS_NAME_FUNCTIONS = ['cn', 'clsx', 'classnames', 'classNames', 'cva', 'twMerge'];

/** The `classNameFunctions` rule option, for a rule schema's `properties`. */
export const CLASS_NAME_FUNCTIONS_OPTION = {
  classNameFunctions: { type: 'array', items: { type: 'string' } },
};

/** One arbitrary value: `min-h-[44px]`, with the utility before it. */
const ARBITRARY_VALUE = /([\w-]+)-\[([^\]]+)\]/g;

/** One arbitrary property: `[min-height:44px]`, a CSS declaration as a class. */
const ARBITRARY_PROPERTY = /(?<![\w-])\[([a-z-]+):([^\]]+)\]/g;

/** An underscore in a bracketed value is Tailwind's spelling of a space. */
const spaced = (value) => value.replaceAll('_', ' ');

/**
 * Tailwind arbitrary values. `shadow-[0_1px_#000]` yields `token`, the class
 * as written; `utility`, `shadow`; and `value`, `0 1px #000`.
 *
 * @param {string} className
 */
export function* arbitraryValues(className) {
  for (const [token, utility, value] of className.matchAll(ARBITRARY_VALUE)) {
    yield { token, utility, value: spaced(value) };
  }
}

/**
 * Tailwind arbitrary properties. `[outline-width:2px]` yields `token`, the
 * class as written; `property`, `outline-width`; and `value`, `2px`.
 *
 * @param {string} className
 */
export function* arbitraryProperties(className) {
  for (const [token, property, value] of className.matchAll(ARBITRARY_PROPERTY)) {
    yield { token, property, value: spaced(value) };
  }
}

/**
 * @param {string} className
 * @returns {string} the className with every arbitrary value taken out
 */
export function withoutArbitraryValues(className) {
  return className.replace(ARBITRARY_VALUE, '');
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
 * Finds every static className string: a `className` or `class` attribute,
 * and the arguments of a class-name helper call, object keys included. Calls
 * are not descended into from the attribute, so `className={cn('a')}` reaches
 * `check` once, from the call. A rule calls `attribute` and `call` from its
 * own visitors.
 *
 * Keys are read at any depth, so a `cva` variant name that looks like a class
 * (`variants: { tone: { 'bg-[#fff]': '...' } }`) is read as one. Variant names
 * are words in practice, so this is accepted rather than special-cased.
 *
 * @param {object} options
 * @param {string[]} [options.functions] class-name helper names
 * @param {(node: object, className: string) => void} check
 */
export function classNameReader({ functions = DEFAULT_CLASS_NAME_FUNCTIONS }, check) {
  const helpers = new Set(functions);
  return {
    /** @param {object} node a JSXAttribute */
    attribute(node) {
      const name = jsxAttributeName(node);
      if (name !== 'className' && name !== 'class') return;
      for (const value of staticStrings(node.value)) check(node, value);
    },

    /** @param {object} node a CallExpression */
    call(node) {
      const callee = calleeName(node.callee);
      if (!callee || !helpers.has(callee)) return;
      for (const argument of node.arguments) {
        for (const value of staticStrings(argument, [], { objectKeys: true })) {
          check(node, value);
        }
      }
    },
  };
}
