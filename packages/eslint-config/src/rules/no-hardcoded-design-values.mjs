// The one contract check consumers cannot reasonably write themselves.
//
// `no-restricted-imports` covers the import bans; nothing built in catches a
// literal `#0f172a` or `rounded-[8px]` buried in a className string. Those are
// exactly the values that make a screen drift off-brand and stop responding to
// [data-theme="dark"], because a literal cannot be re-pointed by a token.
//
// Scope is deliberately narrow — colour, radius, shadow, motion — because those
// are the axes the design system owns. Spacing and font size are not flagged:
// Tailwind's own scales are the sanctioned source for layout, and flagging
// `p-4` would train people to disable the rule.

import {
  COLOR_FUNCTIONS,
  HEX_COLOR,
  MAGIC_DURATION,
  MAGIC_LENGTH,
  axisOf,
  hardcodedAxis,
  isExempt,
} from './value-patterns.mjs';

const DEFAULT_CLASS_NAME_FUNCTIONS = ['cn', 'clsx', 'classnames', 'classNames', 'cva', 'twMerge'];

/** Tailwind arbitrary values: rounded-[8px] -> { utility: 'rounded', value: '8px' } */
function* arbitraryValues(className) {
  for (const [, utility, value] of className.matchAll(/([\w-]+)-\[([^\]]+)\]/g)) {
    yield { utility, value: value.replaceAll('_', ' ') };
  }
}

const RADIUS_UTILITIES = /^rounded(?:-[a-z]+)?$/;
const SHADOW_UTILITIES = /^(?:shadow|drop-shadow|inset-shadow|text-shadow)$/;
const DURATION_UTILITIES = /^(?:duration|delay|ease|animate)$/;
// Anything not matched above falls through to the colour check, which keys off
// the value rather than the utility — so `w-[320px]` is ignored while
// `bg-[#fff]`, `grid-cols-[...rgb()...]` and any future colour-bearing utility
// are caught without maintaining a list of utility prefixes.

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded colour, radius, shadow and motion values; use @elirobinson/tokens instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          classNameFunctions: { type: 'array', items: { type: 'string' } },
          allow: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      color:
        'Hardcoded colour "{{value}}". Use a token — a mapped utility (bg-background, text-muted-foreground), or var(--accent) in an arbitrary value. Run `pnpm ds tokens color` for the list.',
      radius:
        'Hardcoded radius "{{value}}". Use a radius token — rounded-md, or rounded-[var(--radius-md)]. Run `pnpm ds tokens radius`.',
      shadow:
        'Hardcoded shadow "{{value}}". Use a shadow token — shadow-md, or shadow-[var(--shadow-md)]. Run `pnpm ds tokens shadow`.',
      duration:
        'Hardcoded motion value "{{value}}". Use a motion token — duration-[var(--dur-fast)] or ease-[var(--ease-out)]. Run `pnpm ds tokens dur`.',
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const classNameFunctions = new Set(options.classNameFunctions ?? DEFAULT_CLASS_NAME_FUNCTIONS);
    const allow = new Set(options.allow ?? []);

    // A className can be reached twice — once via the JSX attribute and once
    // via the cn() call inside it. Report each finding once.
    const reported = new Set();

    function report(node, messageId, value) {
      if (allow.has(value)) return;
      const key = `${node.range?.[0]}:${node.range?.[1]}:${messageId}:${value}`;
      if (reported.has(key)) return;
      reported.add(key);
      context.report({ node, messageId, data: { value } });
    }

    function checkColor(node, value) {
      if (isExempt(value)) return false;
      const hex = value.match(HEX_COLOR);
      if (hex) {
        report(node, 'color', hex[0]);
        return true;
      }
      if (COLOR_FUNCTIONS.test(value)) {
        report(node, 'color', value.trim());
        return true;
      }
      return false;
    }

    /** A className string: check its arbitrary values, plus any bare literal. */
    function checkClassName(node, className) {
      // The utility decides which axis a value belongs to, so a shadow with an
      // rgba() in it is reported as a shadow rather than as a stray colour.
      for (const { utility, value } of arbitraryValues(className)) {
        if (isExempt(value)) continue;

        if (RADIUS_UTILITIES.test(utility) && MAGIC_LENGTH.test(value)) {
          report(node, 'radius', `${utility}-[${value}]`);
        } else if (SHADOW_UTILITIES.test(utility) && MAGIC_LENGTH.test(value)) {
          report(node, 'shadow', `${utility}-[${value}]`);
        } else if (
          DURATION_UTILITIES.test(utility) &&
          (MAGIC_DURATION.test(value) || value.includes('cubic-bezier'))
        ) {
          report(node, 'duration', `${utility}-[${value}]`);
        } else {
          checkColor(node, value);
        }
      }

      // A colour literal outside an arbitrary value is still a colour literal.
      const outsideArbitrary = className.replace(/[\w-]+-\[[^\]]+\]/g, '');
      checkColor(node, outsideArbitrary);
    }

    /**
     * A style-object property. A style object sets real CSS, so the axis it
     * belongs to is decided by the same shared table the CSS rule reads —
     * `backdropFilter` and `backdrop-filter` resolve alike.
     */
    function checkStyleProperty(node, name, value) {
      const axis = hardcodedAxis(name, value);
      if (!axis) return;

      // The colour axis reports the literal it matched rather than the whole
      // declaration, so a gradient points at the offending stop.
      if (axis === 'color') checkColor(node, value);
      else report(node, axis, value);
    }

    /** Every static string inside an expression, template literals included. */
    function staticStrings(node, out = []) {
      if (!node) return out;

      if (node.type === 'Literal' && typeof node.value === 'string') out.push(node.value);
      else if (node.type === 'TemplateLiteral') {
        for (const quasi of node.quasis) out.push(quasi.value.cooked ?? '');
        for (const expression of node.expressions) staticStrings(expression, out);
      } else if (node.type === 'JSXExpressionContainer') staticStrings(node.expression, out);
      else if (node.type === 'ConditionalExpression') {
        staticStrings(node.consequent, out);
        staticStrings(node.alternate, out);
      } else if (node.type === 'LogicalExpression' || node.type === 'BinaryExpression') {
        staticStrings(node.left, out);
        staticStrings(node.right, out);
      } else if (node.type === 'ArrayExpression') {
        for (const element of node.elements) staticStrings(element, out);
      } else if (node.type === 'ObjectExpression') {
        for (const property of node.properties) {
          if (property.type === 'Property') staticStrings(property.value, out);
        }
      }

      // Calls are deliberately not descended into. `className={cn(...)}` is
      // reachable from both the attribute and the call; letting only the
      // CallExpression visitor own it keeps each finding reported once.
      return out;
    }

    function propertyName(property) {
      if (property.type !== 'Property') return null;
      if (property.key.type === 'Identifier' && !property.computed) return property.key.name;
      if (property.key.type === 'Literal') return String(property.key.value);
      return null;
    }

    function checkStyleObject(node) {
      if (node.type !== 'ObjectExpression') return;

      for (const property of node.properties) {
        const name = propertyName(property);
        if (!name) continue;
        for (const value of staticStrings(property.value)) {
          checkStyleProperty(property.value, name, value);
        }
      }
    }

    return {
      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;

        if (name === 'className' || name === 'class') {
          for (const value of staticStrings(node.value)) checkClassName(node, value);
        } else if (name === 'style' && node.value?.type === 'JSXExpressionContainer') {
          checkStyleObject(node.value.expression);
        }
      },

      CallExpression(node) {
        const callee =
          node.callee.type === 'Identifier'
            ? node.callee.name
            : node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier'
              ? node.callee.property.name
              : null;

        if (!callee || !classNameFunctions.has(callee)) return;
        for (const argument of node.arguments) {
          for (const value of staticStrings(argument)) checkClassName(node, value);
        }
      },

      // Style objects living outside JSX still ship the same literal.
      Property(node) {
        const name = propertyName(node);
        if (!name || !axisOf(name)) return;
        if (node.value.type !== 'Literal' || typeof node.value.value !== 'string') return;
        checkStyleProperty(node.value, name, node.value.value);
      },
    };
  },
};
