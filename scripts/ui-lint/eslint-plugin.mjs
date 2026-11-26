/**
 * Local ESLint rules for the web client's UI gate (rule IDs refer to the UI drift lock plan).
 *
 * - `ui/no-style-elements` (E5, first part): no `<style>`/`<link>` element is created from code —
 *   not as JSX, not through `createElement`/`jsx` — so no stylesheet can enter the page outside the
 *   bundled CSS that Stylelint checks. A tag name the checker cannot prove is not `style`/`link`
 *   is rejected too.
 * - `ui/inline-style-static-keys` (E4, first part): every key of a JSX `style` object literal is a
 *   static name or an expression whose type is a union of string literals, so the properties a
 *   style object can write are always enumerable from the source.
 */

import ts from 'typescript';

const CREATE_ELEMENT_NAMES = new Set(['createElement', 'jsx', 'jsxs', 'jsxDEV']);
const BANNED_TAGS = new Set(['style', 'link']);
const UNENUMERABLE = ts.TypeFlags.StringLike | ts.TypeFlags.Any | ts.TypeFlags.Unknown;

function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier'
  )
    return callee.property.name;
  return undefined;
}

/**
 * The string values `node` can take, or `undefined` when it is not a string at all (a component
 * reference). `null` means "a string the checker cannot enumerate".
 */
function possibleStrings(node, services) {
  if (node.type === 'Literal') return typeof node.value === 'string' ? [node.value] : undefined;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0)
    return [node.quasis.map((quasi) => quasi.value.cooked).join('')];
  if (services?.program == null) return null;
  const type = services.getTypeAtLocation(node);
  const parts = type.isUnion() ? type.types : [type];
  const names = [];
  for (const part of parts) {
    if (part.isStringLiteral()) {
      names.push(part.value);
      continue;
    }
    // A string the type system cannot enumerate (string, template types, branded strings), or a
    // type that could be anything.
    const pieces = part.isIntersection() ? part.types : [part];
    if (pieces.some((piece) => piece.flags & UNENUMERABLE)) return null;
  }
  return names.length > 0 ? names : undefined;
}

const noStyleElements = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow creating <style>/<link> elements from code (UI gate E5).' },
    schema: [],
    messages: {
      element:
        '<{{tag}}> elements are not created from code; styles live in bundled CSS (UI gate E5).',
      dynamic:
        'The element tag here cannot be proven not to be <style>/<link>; use a literal tag (UI gate E5).',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    return {
      JSXOpeningElement(node) {
        if (node.name.type === 'JSXIdentifier' && BANNED_TAGS.has(node.name.name)) {
          context.report({ node, messageId: 'element', data: { tag: node.name.name } });
        }
      },
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (name === undefined || !CREATE_ELEMENT_NAMES.has(name)) return;
        const [first] = node.arguments;
        if (first === undefined || first.type === 'SpreadElement') return;
        const names = possibleStrings(first, services);
        if (names === undefined) return;
        if (names === null) {
          context.report({ node: first, messageId: 'dynamic' });
          return;
        }
        for (const tag of names) {
          if (BANNED_TAGS.has(tag.toLowerCase())) {
            context.report({ node: first, messageId: 'element', data: { tag } });
          }
        }
      },
    };
  },
};

const inlineStyleStaticKeys = {
  meta: {
    type: 'problem',
    docs: { description: 'Require static keys in JSX style objects (UI gate E4).' },
    schema: [],
    messages: {
      computed:
        'Style object keys are static names or string-literal unions; this key hides which property is written (UI gate E4).',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'style') return;
        const value = node.value;
        if (value?.type !== 'JSXExpressionContainer') return;
        const object = value.expression;
        if (object.type !== 'ObjectExpression') return;
        for (const property of object.properties) {
          if (property.type !== 'Property' || !property.computed) continue;
          const key = property.key;
          const isStatic =
            (key.type === 'Literal' && typeof key.value === 'string') ||
            (key.type === 'TemplateLiteral' && key.expressions.length === 0);
          if (isStatic) continue;
          const names = possibleStrings(key, services);
          if (!Array.isArray(names)) context.report({ node: key, messageId: 'computed' });
        }
      },
    };
  },
};

export default {
  meta: { name: 'ui-lint' },
  rules: {
    'no-style-elements': noStyleElements,
    'inline-style-static-keys': inlineStyleStaticKeys,
  },
};
