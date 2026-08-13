// Reading the strings a rule can actually see, shared by the rules that need
// them. Anything computed at run time — a call, a variable, an import — is
// invisible here, and staying silent about it is the point: a rule that guessed
// would fire on code it cannot read.

/**
 * Every static string inside an expression, template literals included.
 *
 * Calls are deliberately not descended into. `className={cn(...)}` is reachable
 * from both the JSX attribute and the call, and letting only a CallExpression
 * visitor own it keeps each finding reported once.
 *
 * @param {object | null | undefined} node
 * @param {string[]} [out]
 * @returns {string[]}
 */
export function staticStrings(node, out = []) {
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

  return out;
}

/**
 * The name of an object property, when it has a static one.
 *
 * @param {object} property
 * @returns {string | null}
 */
export function propertyName(property) {
  if (property.type !== 'Property') return null;
  if (property.key.type === 'Identifier' && !property.computed) return property.key.name;
  if (property.key.type === 'Literal') return String(property.key.value);
  return null;
}

/**
 * The name a JSX element is written under — `Alert`, or `Toast.Description` for
 * a namespaced one.
 *
 * @param {object} nameNode a JSXOpeningElement's `name`
 * @returns {string | null}
 */
export function jsxElementName(nameNode) {
  if (!nameNode) return null;
  if (nameNode.type === 'JSXIdentifier') return nameNode.name;
  if (nameNode.type === 'JSXMemberExpression') {
    const object = jsxElementName(nameNode.object);
    return object ? `${object}.${nameNode.property.name}` : nameNode.property.name;
  }
  return null;
}

/**
 * The name a JSX attribute is written under, namespaced ones included.
 *
 * @param {object} node a JSXAttribute
 * @returns {string | null}
 */
export function jsxAttributeName(node) {
  if (node.name.type === 'JSXIdentifier') return node.name.name;
  if (node.name.type === 'JSXNamespacedName') {
    return `${node.name.namespace.name}:${node.name.name.name}`;
  }
  return null;
}
